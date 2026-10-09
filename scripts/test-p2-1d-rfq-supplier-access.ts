import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { canSupplierAccessRfq } from "../src/lib/rfq-supplier-access";
import { canTransitionRfq } from "../src/lib/rfq-lifecycle";

// Execute the actual server entry points with strictly mocked imports: no database,
// credentials, network, or invitation lifecycle changes are used by these tests.
function loadServerFile(path: string, mocks: Record<string, unknown>) {
  const source = readFileSync(resolve(path), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(output, {
    exports,
    require: (name: string) => {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected import: ${name}`);
      return mocks[name];
    },
    console,
  });
  return exports;
}

const cases: [string, unknown, unknown, boolean][] = [
  ["A PUBLIC", "PUBLIC", null, true],
  ["B MATCHED present / JSON.stringify compatibility", "MATCHED_SUPPLIERS", JSON.stringify([7, 42]), true],
  ["C MATCHED absent", "MATCHED_SUPPLIERS", "[7]", false],
  ["D MATCHED null", "MATCHED_SUPPLIERS", null, false],
  ["E MATCHED empty", "MATCHED_SUPPLIERS", "[]", false],
  ["F MATCHED malformed", "MATCHED_SUPPLIERS", "[42", false],
  ["G MATCHED object", "MATCHED_SUPPLIERS", '{"42":true}', false],
  ["H PRIVATE", "PRIVATE", null, false],
  ["I PRIVATE matched", "PRIVATE", "[42]", false],
  ...["null", "42", '"42"', "true", "", "[\"42\"]", "[42,\"7\"]", "[42,null]", "[42,{}]", "[42,[]]", "[42,true]", "[42,0]", "[42,-1]", "[42,1.5]", "[42,2147483648]", "[42,1e999]"].map(
    (value): [string, unknown, unknown, boolean] => [`Invalid matched data ${value}`, "MATCHED_SUPPLIERS", value, false]
  ),
  ["Native array is not stored JSON", "MATCHED_SUPPLIERS", [42], false],
  ["Missing matched data", "MATCHED_SUPPLIERS", undefined, false],
  ["Unknown visibility", "OTHER", "[42]", false],
  ["Missing visibility", undefined, "[42]", false],
];

async function main() {
  let checks = 0;
  for (const [name, visibility, matchedSuppliers, allowed] of cases) {
    assert.equal(canSupplierAccessRfq({ visibility, matchedSuppliers }, 42), allowed, name);
    checks++;
  }
  const invalidIds: unknown[] = [null, undefined, "42", "42abc", "", " 42 ", 0, -1, 1.5, NaN, Infinity, -Infinity, 2147483648, Number.MAX_SAFE_INTEGER + 1, true, {}, [42]];
  for (const supplierId of invalidIds) {
    for (const visibility of ["PUBLIC", "MATCHED_SUPPLIERS", "PRIVATE"]) {
      assert.equal(canSupplierAccessRfq({ visibility, matchedSuppliers: "[42]" }, supplierId), false);
      checks++;
    }
  }

  const testUserId = 1;
  const testUserEmail = "supplier@example.test";
  let session: any = { user: { id: String(testUserId), email: testUserEmail, role: "SUPPLIER" } };
  let supplierId: unknown = 42;
  let supplierRole = "SUPPLIER";
  let accountStatus = "ACTIVE";
  let supplierStatus = "PENDING";
  let rfqReads = 0;
  let attachmentReads = 0;
  let rfq: any;
  let itemReads = 0;
  let transactions = 0;
  let invitationReads = 0;
  const prisma = {
    user: { findUnique: async ({ where }: any) => {
      if (!where || typeof where !== "object") return null;
      const keys = Object.keys(where);
      const matchesIdentity = keys.length === 1 && (
        (keys[0] === "id" && where.id === testUserId) ||
        (keys[0] === "email" && where.email === testUserEmail)
      );
      if (!matchesIdentity) return null;
      return { id: testUserId, email: testUserEmail, role: supplierRole, status: accountStatus, supplierId,
        supplier: { id: supplierId, name: "Test", verifiedStatus: supplierStatus } };
    } },
    rFQ: { findUnique: async () => { rfqReads++; return rfq; } },
    rFQItem: { findMany: async () => { itemReads++; return []; } },
    quote: { findFirst: async ({ where, select }: any) => {
      attachmentReads++;
      assert.equal(where.rfqId, 9);
      assert.equal(where.supplierId, 42, "Forged form supplierId never chooses the quote owner");
      assert.equal(select.attachments, true);
      return null;
    } },
    $transaction: async () => { transactions++; throw new Error("Unexpected write"); },
    rFQInvitation: { findUnique: async () => { invitationReads++; return { rfqId: 9, supplierId: 42 }; } },
  };
  assert.equal((await prisma.user.findUnique({ where: { id: testUserId } }))?.id, testUserId);
  assert.equal((await prisma.user.findUnique({ where: { email: testUserEmail } }))?.id, testUserId);
  checks += 2;
  for (const where of [
    { id: 2 }, { id: "1" }, { email: "other@example.test" },
    { email: "SUPPLIER@example.test" }, { id: testUserId, email: "other@example.test" },
    {}, null,
  ]) {
    assert.equal(await prisma.user.findUnique({ where }), null, "Unknown or ambiguous user identity must not match");
    checks++;
  }
  const notFound = () => { throw new Error("NOT_FOUND"); };
  const authMock = { auth: async () => session };
  const supplierWrite = loadServerFile("src/lib/supplier-write-access.ts", {
    "@/lib/auth": authMock,
    "@/lib/prisma": { prisma },
  });
  const uploadPolicy = loadServerFile("src/lib/upload-policy.ts", {
    "@/lib/auth": authMock,
    "@/lib/prisma": { prisma },
    "@/lib/supplier-write-access": supplierWrite,
    "@/lib/buyer-company": { requireVerifiedBuyer: async () => { throw new Error("Unexpected buyer access"); } },
  });
  assert.throws(() => loadServerFile("src/lib/supplier-write-access.ts", {}), /Unexpected import: @\/lib\/auth/);
  const mocks = {
    "@/lib/auth": authMock,
    "@/lib/supplier-write-access": supplierWrite,
    "@/lib/upload-policy": uploadPolicy,
    "@/lib/prisma": { prisma },
    "@/lib/db": { prisma },
    "@/lib/rfq-supplier-access": { canSupplierAccessRfq },
    "@/lib/rfq-lifecycle": { canTransitionRfq },
    "@/lib/rfq-invitation": { markInvitationQuoted: async () => { throw new Error("Unexpected invitation write"); } },
    "@/lib/analytics": { writeBusinessEvent: async () => { throw new Error("Unexpected analytics write"); } },
    "next/server": { NextResponse: { json: (body: unknown, init?: { status: number }) => ({ body, status: init?.status ?? 200 }) } },
    "next/navigation": { notFound, redirect: () => { throw new Error("REDIRECT"); } },
    "react": { Suspense: "Suspense" },
    "react/jsx-runtime": { jsx: () => ({}), jsxs: () => ({}) },
    "next/link": { default: "Link" },
    "@/components/QuoteForm": { default: "QuoteForm" },
    "@/components/RfqImages": { default: "RfqImages" },
    "@/components/ui/badge": { Badge: "Badge" },
    "lucide-react": { FileText: "FileText" },
  };
  const post = loadServerFile("src/app/api/quote/route.ts", mocks).POST;
  const pages = ["src/app/supplier/rfqs/[id]/page.tsx", "src/app/rfq/[id]/quote/page.tsx"].map(
    (path) => loadServerFile(path, mocks).default
  );
  const request = {
    formData: async () => new Map([
      ["rfqId", "9"], ["supplierId", "7"],
      ["invitationToken", "valid-invitation"],
      ["items", JSON.stringify([{ rfqItemId: 100, unitPrice: 10 }])],
    ]),
  };
  for (const [name, visibility, matchedSuppliers, allowed] of cases) {
    rfq = { id: 9, visibility, matchedSuppliers, status: "COLLECTING", quotes: [], items: [], images: null, attachments: null };
    itemReads = invitationReads = 0;
    const response = await post(request);
    // Allowed requests reach item ownership validation; denied requests stop at 403.
    assert.equal(response.status, allowed ? 400 : 403, `POST ${name}`);
    assert.equal(itemReads, allowed ? 1 : 0, `POST read boundary ${name}`);
    if (!allowed) assert.equal(response.body.code, "FORBIDDEN");
    for (const page of pages) {
      const render = () => page({ params: { id: "9" }, searchParams: { inv: "valid-invitation" } });
      if (allowed) await render();
      else await assert.rejects(render, /NOT_FOUND/, `Page ${name}`);
    }
    assert.equal(invitationReads, allowed ? 2 : 0, `Invitation cannot bypass ${name}`);
    checks += 3;
  }
  rfq = { visibility: "PUBLIC", matchedSuppliers: null, status: "COLLECTING" };
  for (const invalidId of invalidIds) {
    supplierId = invalidId;
    assert.equal((await post(request)).status, 403, "POST malformed database supplier ID");
    checks++;
  }
  supplierId = 42;
  session = null;
  assert.equal((await post(request)).status, 401);
  session = { user: { id: "1", role: "BUYER" } };
  supplierRole = "BUYER";
  const wrongRole = await post(request);
  assert.equal(wrongRole.status, 403);
  assert.equal(wrongRole.body.code, "SUPPLIER_ROLE_REQUIRED");
  supplierRole = "SUPPLIER";
  session = { user: { id: "1", role: "SUPPLIER" } };
  for (const [status, verification, code] of [
    ["DISABLED", "PENDING", "SUPPLIER_ACCOUNT_INACTIVE"],
    ["ACTIVE", "DISABLED", "SUPPLIER_DISABLED"],
    ["ACTIVE", "REJECTED", "SUPPLIER_REJECTED"],
    ["ACTIVE", "UNKNOWN", "SUPPLIER_DISABLED"],
  ]) {
    accountStatus = status; supplierStatus = verification;
    rfqReads = itemReads = attachmentReads = invitationReads = 0;
    const response = await post(request);
    assert.equal(response.status, 403);
    assert.equal(response.body.code, code);
    assert.equal(rfqReads + itemReads + attachmentReads + invitationReads, 0, "Denied account stops before business reads");
    assert.equal(transactions, 0);
    checks++;
  }
  accountStatus = "ACTIVE"; supplierStatus = "PENDING";
  for (const attachment of [
    "/uploads/quote-attachment/supplier-7/1-aaaaaaaaaaaa.pdf",
    "/uploads/product-image/supplier-42/1-aaaaaaaaaaaa.png",
    "https://example.test/file.pdf",
  ]) {
    const form = await request.formData();
    form.set("attachments", JSON.stringify([attachment]));
    itemReads = 0;
    const response = await post({ formData: async () => form });
    assert.equal(response.status, 400, "Cross-supplier, wrong-scope and external attachments fail closed");
    assert.equal(itemReads, 0);
    assert.equal(transactions, 0);
    checks++;
  }
  assert.equal(transactions, 0, "No unauthorized quote or invitation writes");
  console.log(`P2-1D passed: ${checks + 3} checks (policy, both server pages, direct POST; no database access).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
