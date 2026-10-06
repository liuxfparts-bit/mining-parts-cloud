import assert from "node:assert/strict";
import { canSupplierAccessRfq, canUserReadRfq } from "../src/lib/rfq-supplier-access";

const rfqs = {
  PUBLIC: { visibility: "PUBLIC", matchedSuppliers: null, userID: 10, companyID: 100, businessAuthenticity: "REAL" },
  MATCHED_SUPPLIERS: { visibility: "MATCHED_SUPPLIERS", matchedSuppliers: "[7]", userID: 10, companyID: 100, businessAuthenticity: "REAL" },
  PRIVATE: { visibility: "PRIVATE", matchedSuppliers: "[7]", userID: 10, companyID: 100, businessAuthenticity: "REAL" },
} as const;

const users = {
  anonymous: null,
  matchedSupplier: { id: 20, role: "SUPPLIER", supplierId: 7, buyerCompanyId: null },
  unmatchedSupplier: { id: 21, role: "SUPPLIER", supplierId: 8, buyerCompanyId: null },
  creatorBuyer: { id: 10, role: "BUYER", supplierId: null, buyerCompanyId: 100 },
  sameCompanyBuyer: { id: 11, role: "BUYER", supplierId: null, buyerCompanyId: 100 },
  otherBuyer: { id: 12, role: "BUYER", supplierId: null, buyerCompanyId: 200 },
  admin: { id: 1, role: "ADMIN", supplierId: null, buyerCompanyId: null },
} as const;

const expected = {
  anonymous: [true, false, false],
  matchedSupplier: [true, true, false],
  unmatchedSupplier: [true, false, false],
  creatorBuyer: [true, true, true],
  sameCompanyBuyer: [true, true, true],
  otherBuyer: [true, false, false],
  admin: [true, true, true],
} as const;

const visibilities = ["PUBLIC", "MATCHED_SUPPLIERS", "PRIVATE"] as const;
for (const [name, user] of Object.entries(users)) {
  visibilities.forEach((visibility, index) => {
    assert.equal(
      canUserReadRfq(rfqs[visibility], user),
      expected[name as keyof typeof expected][index],
      `${name} / ${visibility}`
    );
  });
}

for (const malformed of [null, "[", "null", "{}", "42", '[7,"8"]', "[0]", "[-1]", "[1.5]"]) {
  assert.equal(
    canSupplierAccessRfq({ visibility: "MATCHED_SUPPLIERS", matchedSuppliers: malformed }, 7),
    false,
    `malformed matchedSuppliers must fail closed: ${String(malformed)}`
  );
}

assert.equal(canSupplierAccessRfq({ visibility: "PRIVATE", matchedSuppliers: "[7]" }, 7), false);
assert.equal(canUserReadRfq({ visibility: "UNKNOWN", userID: 99, companyID: 999, businessAuthenticity: "REAL" }, null), false);
assert.equal(canUserReadRfq({ visibility: "PUBLIC", userID: 10, companyID: 100, businessAuthenticity: "TEST" }, null), false);
assert.equal(canUserReadRfq({ visibility: "PUBLIC", userID: 10, companyID: 100, businessAuthenticity: "UNKNOWN" }, null), false);
assert.equal(canUserReadRfq({ visibility: "PUBLIC", userID: 10, companyID: 100, businessAuthenticity: "TEST" }, users.creatorBuyer), true);
assert.equal(canUserReadRfq({ visibility: "PUBLIC", userID: 10, companyID: 100, businessAuthenticity: "TEST" }, users.admin), true);

console.log("WP0-2 RFQ access matrix PASS");
