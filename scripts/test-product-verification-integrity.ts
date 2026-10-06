import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  changedProductTrustFields,
  productApprovalDependencyErrors,
} from "../src/lib/product-verification";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const current = {
  name: "Pump",
  productType: "Aftermarket",
  description: "A",
  images: "a.jpg",
  price: 100,
  currency: "CNY",
  moq: 1,
  stockStatus: "IN_STOCK",
  stock: 2,
  leadTime: "7 days",
  warranty: "3 months",
};

assert.deepEqual(
  changedProductTrustFields(current, { ...current, price: 120, stock: 5 }),
  [],
  "commercial-only edits must not invalidate technical/product verification"
);
assert.deepEqual(
  changedProductTrustFields(current, { ...current, productType: "OEM" }),
  ["productType"],
  "OEM/product-type claim changes must invalidate verification"
);
assert.deepEqual(
  changedProductTrustFields(
    { ...current, partNumberId: 1, supplierId: 1 },
    { ...current, partNumberId: 2, supplierId: 1 }
  ),
  ["partNumberId"],
  "future PN identity changes must be classified as trust-bearing"
);
assert.deepEqual(
  changedProductTrustFields(current, { ...current, images: "b.jpg", description: "B" }).sort(),
  ["description", "images"],
  "description/images are trust-relevant"
);

assert.deepEqual(
  productApprovalDependencyErrors({
    partNumberVerificationStatus: "VERIFIED",
    partNumberPublishStatus: "READY",
    supplierVerifiedStatus: "VERIFIED",
    supplierApprovedAt: new Date(),
    supplierApprovedBy: 1,
    disabledSupplierUsers: 0,
  }),
  [],
  "fully trusted dependency chain must be approvable"
);
assert.equal(
  productApprovalDependencyErrors({
    partNumberVerificationStatus: "UNVERIFIED",
    partNumberPublishStatus: "HOLD",
    supplierVerifiedStatus: "VERIFIED",
    supplierApprovedAt: null,
    supplierApprovedBy: null,
    disabledSupplierUsers: 1,
  }).length,
  4,
  "broken PN/supplier trust chain must fail closed"
);

const supplierPut = read("src/app/api/supplier/product/[id]/route.ts");
assert.match(supplierPut, /PRODUCT_VERIFICATION_INVALIDATED/);
assert.match(supplierPut, /tx\.securityAuditLog\.create/);
assert.match(supplierPut, /updatedAt: product\.updatedAt/);
assert.match(supplierPut, /verificationStatus = "PENDING"/);

const adminActions = read("src/app/admin/actions.ts");
assert.match(adminActions, /productApprovalDependencyErrors/);
assert.match(adminActions, /PRODUCT_APPROVAL_BLOCKED/);
assert.match(adminActions, /status: "PENDING"/);
assert.match(adminActions, /verificationStatus: "PENDING"/);
assert.match(adminActions, /updatedAt: product\.updatedAt/);

console.log("P0-3 Product Verification Integrity checks passed");
