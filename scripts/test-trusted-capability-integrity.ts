import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const publicProduct = read("src/lib/public-product.ts");
assert(publicProduct.includes("TRUSTED_CAPABILITY_PRODUCT_WHERE_NESTED"), "trusted capability nested predicate missing");
assert(publicProduct.includes("TRUSTED_CAPABILITY_PRODUCT_WHERE"), "trusted capability predicate missing");
assert(publicProduct.includes('verificationStatus: "VERIFIED"'), "Product VERIFIED requirement missing");
assert(publicProduct.includes("PUBLIC_SUPPLIER_IDENTITY_WHERE"), "formal Supplier identity predicate missing");
assert(publicProduct.includes('status: "PUBLISHED"') && publicProduct.includes("...TRUSTED_CAPABILITY_PRODUCT_WHERE"), "public capability must add PUBLISHED to trusted capability");

const capability = read("src/lib/supplier-capability.ts");
assert(capability.includes("TRUSTED_CAPABILITY_PRODUCT_WHERE_NESTED"), "capability helper must consume canonical trust predicate");
assert(capability.includes("resolveTrustedPartNumberId"), "trusted PN resolver missing");
assert(capability.includes("return result.partNumberId"), "PN resolution must not require a supplier result");

const actions = read("src/app/actions.ts");
assert(actions.includes("resolveTrustedPartNumberId"), "RFQ creation must use technical PN resolver");
assert(!actions.includes("findTrustedSupplierIdsForPartNumber(pn)"), "RFQ PN binding still coupled to supplier capability");

const recommendation = read("src/lib/rfq-invitation.ts");
for (const needle of [
  'CapabilityTrustTier = "TRUSTED" | "OBSERVED" | "CLAIMED"',
  "TRUST_TIER_RANK",
  "PUBLIC_PRODUCT_WHERE",
  'businessAuthenticity: "REAL"',
  'trustTier === "TRUSTED"',
  'trustTier === "OBSERVED"',
  'TRUST_TIER_RANK[b.trustTier] - TRUST_TIER_RANK[a.trustTier]',
]) {
  assert(recommendation.includes(needle), `recommendation policy missing: ${needle}`);
}
assert(!recommendation.includes('if (s.memberLevel === "GOLD") score'), "GOLD membership still changes trust/relevance score");
assert(!recommendation.includes('if (s.memberLevel === "SILVER") score'), "SILVER membership still changes trust/relevance score");

const invitePage = read("src/app/dashboard/rfqs/[id]/invite/page.tsx");
assert(invitePage.includes('businessAuthenticity: "REAL"'), "My Suppliers must exclude TEST/UNKNOWN quotes");
assert(invitePage.includes("PUBLIC_SUPPLIER_IDENTITY_WHERE"), "verified-only supplier search must use formal identity trust");
assert(invitePage.includes("trustTier: r.trustTier"), "recommendation tier not passed to UI");

const invitePanel = read("src/app/dashboard/rfqs/[id]/invite/InvitePanel.tsx");
for (const label of ["可信供货能力", "真实业务记录", "供应声明", "企业已审核"]) {
  assert(invitePanel.includes(label), `invite UI missing trust label: ${label}`);
}
assert(invitePanel.includes("真实报价"), "quote history label must describe REAL quote semantics");

const buyerSuppliers = read("src/app/dashboard/suppliers/page.tsx");
assert(buyerSuppliers.includes('businessAuthenticity: "REAL"'), "buyer supplier aggregation must exclude TEST/UNKNOWN quotes");
assert(buyerSuppliers.includes("真实报价次数"), "buyer supplier UI must state REAL quote semantics");

console.log("Trust Kernel P0-5 Trusted Capability Integrity: PASS");
console.log("Policy: TRUSTED > OBSERVED > CLAIMED; membership never upgrades trust");
