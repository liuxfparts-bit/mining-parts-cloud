import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PUBLIC_PRODUCT_WHERE,
  PUBLIC_SUPPLIER_IDENTITY_WHERE,
  PUBLIC_SUPPLIER_WHERE,
} from "../src/lib/public-product";
import { PUBLIC_PN_WHERE } from "../src/lib/part-number";

assert.equal(PUBLIC_PN_WHERE.verificationStatus, "VERIFIED");
assert.equal(PUBLIC_PN_WHERE.publishStatus, "READY");

assert.equal(PUBLIC_SUPPLIER_IDENTITY_WHERE.verifiedStatus, "VERIFIED");
assert.deepEqual(PUBLIC_SUPPLIER_IDENTITY_WHERE.approvedAt, { not: null });
assert.deepEqual(PUBLIC_SUPPLIER_IDENTITY_WHERE.approvedBy, { not: null });
assert.equal(PUBLIC_SUPPLIER_IDENTITY_WHERE.users.none.status, "DISABLED");
assert.deepEqual(PUBLIC_SUPPLIER_WHERE.products.some, PUBLIC_PRODUCT_WHERE);

assert.equal(PUBLIC_PRODUCT_WHERE.status, "PUBLISHED");
assert.equal(PUBLIC_PRODUCT_WHERE.verificationStatus, "VERIFIED");
assert.equal(PUBLIC_PRODUCT_WHERE.partNumber.verificationStatus, "VERIFIED");
assert.equal(PUBLIC_PRODUCT_WHERE.partNumber.publishStatus, "READY");
assert.deepEqual(PUBLIC_PRODUCT_WHERE_NESTED_SUPPLIER(), PUBLIC_SUPPLIER_IDENTITY_WHERE);

const home = readFileSync("src/app/page.tsx", "utf8");
assert.match(home, /supplier\.findMany\(\{ where: PUBLIC_SUPPLIER_WHERE/);
assert.match(home, /where: PUBLIC_PN_WHERE/);
assert.match(home, /partNumbers: \{ where: PUBLIC_PN_WHERE \}/);
assert.match(home, /partNumberRelations: \{ where: \{ partNumber: PUBLIC_PN_WHERE \} \}/);
assert.match(home, /rFQ\.findMany\(\{ where: \{ status: "COLLECTING", visibility: "PUBLIC" \}/);
assert.match(home, /products: \{ where: PUBLIC_PRODUCT_WHERE \}/);

const directory = readFileSync("src/app/suppliers/page.tsx", "utf8");
assert.match(directory, /\.\.\.PUBLIC_SUPPLIER_WHERE/);
assert.match(directory, /products: \{ where: PUBLIC_PRODUCT_WHERE \}/);

const detail = readFileSync("src/app/suppliers/[slug]/page.tsx", "utf8");
assert.match(detail, /findFirst/);
assert.match(detail, /PUBLIC_SUPPLIER_WHERE/);
assert.match(detail, /where: PUBLIC_PRODUCT_WHERE/);
assert.doesNotMatch(detail, /s\.responseRate|s\.viewCount|s\.inquiryCount/);

const search = readFileSync("src/app/search/page.tsx", "utf8");
assert.match(search, /\.\.\.PUBLIC_PN_WHERE/);
assert.match(search, /\.\.\.PUBLIC_SUPPLIER_WHERE/);
assert.match(search, /status: "ACTIVE", OR:/);

const brandDetail = readFileSync("src/app/brands/[slug]/page.tsx", "utf8");
assert.match(brandDetail, /where: \{ slug: params\.slug, status: "ACTIVE" \}/);
assert.match(brandDetail, /where: PUBLIC_PN_WHERE/);

const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
assert.match(sitemap, /PUBLIC_PN_WHERE/);
assert.match(sitemap, /PUBLIC_SUPPLIER_WHERE/);
assert.match(sitemap, /https:\/\/kuangpeiyun\.com/);
assert.doesNotMatch(sitemap, /mpc\.example\.com/);

const robots = readFileSync("public/robots.txt", "utf8");
assert.match(robots, /https:\/\/kuangpeiyun\.com\/sitemap\.xml/);
assert.doesNotMatch(robots, /mpc\.example\.com/);

const adminActions = readFileSync("src/app/admin/actions.ts", "utf8");
const updateCompanyBody = adminActions.slice(
  adminActions.indexOf("export async function updateCompany"),
  adminActions.indexOf("// 审核通过")
);
assert.doesNotMatch(updateCompanyBody, /verifiedStatus\s*:/);
assert.match(adminActions, /approvedAt: now/);
assert.match(adminActions, /action: status === "VERIFIED" \? "SUPPLIER_APPROVED" : "SUPPLIER_REJECTED"/);

const supplierEdit = readFileSync("src/app/admin/suppliers/[id]/edit/SupplierEditClient.tsx", "utf8");
assert.doesNotMatch(supplierEdit, /<select name="verifiedStatus"/);

console.log("WP0-3 / Trust Kernel public truth checks passed");

function PUBLIC_PRODUCT_WHERE_NESTED_SUPPLIER() {
  // Avoid importing another symbol only for this assertion: direct Product rule
  // carries the same nested supplier identity predicate.
  return (PUBLIC_PRODUCT_WHERE as any).supplier;
}
