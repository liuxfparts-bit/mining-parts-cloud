import fs from "node:fs";
import path from "node:path";
import { supplierWritePolicyAllowsStatus } from "../src/lib/supplier-write-access";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const business = ["PENDING", "VERIFIED"];
for (const status of business) assert(supplierWritePolicyAllowsStatus("BUSINESS", status), `BUSINESS must allow ${status}`);
for (const status of ["REJECTED", "DISABLED", "UNKNOWN", ""]) assert(!supplierWritePolicyAllowsStatus("BUSINESS", status), `BUSINESS must block ${status || "empty"}`);
for (const status of ["PENDING", "VERIFIED", "REJECTED"]) assert(supplierWritePolicyAllowsStatus("PROFILE", status), `PROFILE must allow ${status}`);
for (const status of ["DISABLED", "UNKNOWN", ""]) assert(!supplierWritePolicyAllowsStatus("PROFILE", status), `PROFILE must block ${status || "empty"}`);

const helper = read("src/lib/supplier-write-access.ts");
for (const needle of ['user.role !== "SUPPLIER"', 'user.status !== "ACTIVE"', '!user.supplierId', '!user.supplier', 'supplierWritePolicyAllowsStatus(policy, supplierStatus)']) {
  assert(helper.includes(needle), `canonical gate missing: ${needle}`);
}

const businessMutationFiles = [
  "src/app/api/quote/route.ts",
  "src/app/api/supplier/product/route.ts",
  "src/app/api/supplier/product/[id]/route.ts",
  "src/app/supplier/actions.ts",
  "src/app/supplier/quotes/actions.ts",
  "src/app/supplier/invitations/actions.ts",
  "src/app/rfq/invite/[token]/actions.ts",
  "src/app/equipment/request/actions.ts",
  "src/app/part-number/request/actions.ts",
  "src/app/supplier/part-number-requests/new/page.tsx",
  "src/app/supplier/part-number-requests/[id]/edit/page.tsx",
];
for (const rel of businessMutationFiles) {
  const src = read(rel);
  assert(src.includes('SupplierWriteAccess("BUSINESS")'), `${rel} does not use BUSINESS supplier write gate`);
}

const profile = read("src/app/api/supplier/profile/route.ts");
assert(profile.includes('resolveSupplierWriteAccess("PROFILE")'), "supplier profile must use PROFILE gate");

const productUpdate = read("src/app/api/supplier/product/[id]/route.ts");
assert(productUpdate.includes("product.supplierId !== supplierId"), "product update ownership guard missing");
const invitationActions = read("src/app/supplier/invitations/actions.ts");
assert(invitationActions.includes("inv.supplierId !== supplierId"), "invitation ownership guard missing");
const pnEdit = read("src/app/supplier/part-number-requests/[id]/edit/page.tsx");
assert(pnEdit.includes("req.supplierId !== access.supplierId"), "PN request ownership guard missing");
const quoteWithdraw = read("src/app/supplier/quotes/actions.ts");
assert(quoteWithdraw.includes("withdrawQuoteForSupplier(quoteId, access.supplierId)"), "quote withdrawal must be scoped to canonical supplier");

console.log("Trust Kernel P0-4 supplier write authorization: PASS");
console.log(`Covered business mutation surfaces: ${businessMutationFiles.length}; profile surfaces: 1`);
