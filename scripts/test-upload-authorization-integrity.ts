import fs from "node:fs";
import path from "node:path";
import {
  UPLOAD_POLICIES,
  fileSignatureMatches,
  isOwnedUploadUrl,
  isUploadScope,
  splitStoredUploadUrls,
  uploadPrincipal,
  uploadUrlsBelongToPrincipal,
} from "../src/lib/upload-policy";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

assert(isUploadScope("rfq-image"), "rfq-image scope missing");
assert(isUploadScope("buyer-license"), "buyer-license scope missing");
assert(isUploadScope("quote-attachment"), "quote-attachment scope missing");
assert(isUploadScope("product-image"), "product-image scope missing");
assert(isUploadScope("admin-image"), "admin-image scope missing");
assert(!isUploadScope("rfq"), "legacy/default rfq scope must not be accepted");
assert(!isUploadScope("../admin"), "arbitrary scope must not be accepted");
assert(UPLOAD_POLICIES["rfq-image"].role === "BUYER", "RFQ upload must be BUYER-only");
assert(UPLOAD_POLICIES["buyer-license"].role === "BUYER", "Buyer license upload must be BUYER-only");
assert(UPLOAD_POLICIES["quote-attachment"].role === "SUPPLIER", "Quote upload must be SUPPLIER-only");
assert(UPLOAD_POLICIES["product-image"].role === "SUPPLIER", "Product upload must be SUPPLIER-only");
assert(UPLOAD_POLICIES["admin-image"].role === "ADMIN", "Admin upload must be ADMIN-only");
assert(!UPLOAD_POLICIES["product-image"].allowedMimes.includes("application/pdf"), "Product scope must reject documents");
assert(UPLOAD_POLICIES["quote-attachment"].allowedMimes.includes("application/pdf"), "Quote scope must allow PDF");

const supplierPrincipal = uploadPrincipal("SUPPLIER", 7);
const owned = "/uploads/product-image/supplier-7/1700000000000-abcdef123456.jpg";
assert(isOwnedUploadUrl(owned, "product-image", supplierPrincipal), "owned Product URL rejected");
assert(!isOwnedUploadUrl(owned, "product-image", uploadPrincipal("SUPPLIER", 8)), "cross-Supplier Product URL accepted");
assert(!isOwnedUploadUrl(owned, "rfq-image", uploadPrincipal("BUYER", 7)), "cross-scope URL accepted");
assert(!isOwnedUploadUrl("https://evil.example/x.jpg", "product-image", supplierPrincipal), "external URL accepted as owned upload");
assert(uploadUrlsBelongToPrincipal([owned], "product-image", supplierPrincipal), "owned URL list rejected");
assert(uploadUrlsBelongToPrincipal(["/uploads/rfq/legacy.jpg"], "product-image", supplierPrincipal, ["/uploads/rfq/legacy.jpg"]), "grandfathered legacy URL rejected");
assert(!uploadUrlsBelongToPrincipal(["/uploads/rfq/legacy.jpg"], "product-image", supplierPrincipal), "new legacy URL accepted");
assert(splitStoredUploadUrls('["/a","/b"]').length === 2, "JSON URL list parse failed");
assert(splitStoredUploadUrls("/a,/b").length === 2, "CSV URL list parse failed");

assert(fileSignatureMatches(Buffer.from([0xff,0xd8,0xff,0x00]), "image/jpeg"), "JPEG signature rejected");
assert(fileSignatureMatches(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), "image/png"), "PNG signature rejected");
assert(fileSignatureMatches(Buffer.from("%PDF-1.7"), "application/pdf"), "PDF signature rejected");
assert(!fileSignatureMatches(Buffer.from("<html>evil</html>"), "image/jpeg"), "spoofed JPEG accepted");

const route = read("src/app/api/upload/route.ts");
for (const needle of ["resolveUploadAuthorization(scope)", "fileSignatureMatches", "MAX_REQUEST", "rateLimit(", '{ flag: "wx" }']) {
  assert(route.includes(needle), `upload route missing control: ${needle}`);
}
assert(!route.includes('form.get("scope") || "rfq"'), "upload route still has implicit default scope");

const readRoute = read("src/app/uploads/[...path]/route.ts");
for (const needle of [
  'segment === ".."',
  'fp.startsWith(root + path.sep)',
  "canReadProductUpload",
  "canReadRfqUpload",
  "canReadQuoteUpload",
  "canReadBuyerLicense",
  "canReadPartNumberUpload",
  "canReadSupplierUpload",
  "canReadSupplierRequestUpload",
  '"X-Content-Type-Options": "nosniff"',
  '"private, no-store"',
]) {
  assert(readRoute.includes(needle), `upload read route missing control: ${needle}`);
}
assert(readRoute.includes('scope === "rfq" || scope === "quote"'), "legacy upload read compatibility missing");

const callers = [
  ["src/app/admin/banners/ImageUploader.tsx", "admin-image"],
  ["src/app/admin/brands/[id]/BrandLogoUploader.tsx", "admin-image"],
  ["src/app/admin/equipment/new/BrandCreateModal.tsx", "admin-image"],
  ["src/app/admin/equipment/new/ImageUploader.tsx", "admin-image"],
  ["src/app/admin/equipment/[id]/edit/BrandCreateModal.tsx", "admin-image"],
  ["src/app/admin/equipment/[id]/edit/ImageUploader.tsx", "admin-image"],
  ["src/app/supplier/products/new/NewProductClient.tsx", "product-image"],
  ["src/app/supplier/products/[id]/edit/ProductEditClient.tsx", "product-image"],
  ["src/components/QuoteForm.tsx", "quote-attachment"],
  ["src/components/RFQForm.tsx", "rfq-image"],
] as const;
for (const [rel, scope] of callers) {
  const src = read(rel);
  assert(src.includes("/api/upload"), `${rel} upload call missing`);
  assert(src.includes(`append("scope", "${scope}")`), `${rel} missing explicit ${scope}`);
}
const generic = read("src/components/ImageUpload.tsx");
assert(generic.includes('append("scope", scope)'), "generic ImageUpload must require explicit scope");
const buyerCompanyPage = read("src/app/dashboard/company/page.tsx");
const buyerCompanyAction = read("src/app/dashboard/company/actions.ts");
assert(buyerCompanyPage.includes('scope="buyer-license"'), "Buyer license uploader missing buyer-license scope");
assert(buyerCompanyAction.includes('"buyer-license", licensePrincipal') && buyerCompanyAction.includes('user.status !== "ACTIVE"'), "Buyer license ownership/account guard missing");

const supplierCreate = read("src/app/api/supplier/product/route.ts");
const supplierUpdate = read("src/app/api/supplier/product/[id]/route.ts");
const quote = read("src/app/api/quote/route.ts");
const rfq = read("src/app/actions.ts");
assert(supplierCreate.includes('uploadUrlsBelongToPrincipal(imageUrls, "product-image"'), "Product create ownership guard missing");
assert(supplierUpdate.includes('uploadUrlsBelongToPrincipal(imageUrls, "product-image"') && supplierUpdate.includes("existingImageUrls"), "Product update legacy-safe ownership guard missing");
assert(quote.includes('uploadUrlsBelongToPrincipal(attachments, "quote-attachment"') && quote.includes("previousAttachments"), "Quote attachment ownership guard missing");
assert(rfq.includes('uploadUrlsBelongToPrincipal(it.images || [], "rfq-image"'), "RFQ image ownership guard missing");

console.log("Trust Kernel P0-4A upload authorization integrity: PASS");
console.log(`Explicit upload callers covered: ${callers.length} + 1 generic scoped component`);
