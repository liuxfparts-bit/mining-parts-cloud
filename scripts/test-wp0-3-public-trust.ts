import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PUBLIC_PRODUCT_WHERE, PUBLIC_SUPPLIER_WHERE } from "../src/lib/public-product";

assert.equal(PUBLIC_SUPPLIER_WHERE.verifiedStatus, "VERIFIED");
assert.equal(PUBLIC_SUPPLIER_WHERE.users.none.status, "DISABLED");
assert.deepEqual(PUBLIC_SUPPLIER_WHERE.products.some, PUBLIC_PRODUCT_WHERE);
assert.equal(PUBLIC_PRODUCT_WHERE.status, "PUBLISHED");
assert.equal(PUBLIC_PRODUCT_WHERE.verificationStatus, "VERIFIED");
assert.equal(PUBLIC_PRODUCT_WHERE.partNumber.publishStatus, "READY");

const home = readFileSync("src/app/page.tsx", "utf8");
assert.match(home, /supplier\.findMany\(\{ where: PUBLIC_SUPPLIER_WHERE/);
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

console.log("WP0-3 public trust checks passed");
