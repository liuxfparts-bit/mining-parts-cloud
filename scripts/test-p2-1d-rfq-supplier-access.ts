import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { canSupplierAccessRfq } from "../src/lib/rfq-supplier-access";

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

  let session: any = { user: { id: "1", email: "supplier@example.test", role: "SUPPLIER" } };
  let supplierId: unknown = 42;
  let rfq: any;
  let itemReads = 0;
  let transactions = 0;
  let invitationReads = 0;
  const prisma = {
    user: { findUnique: async () => ({ id: 1, supplierId, supplier: { id: supplierId, name: "Test" } }) },
    rFQ: { findUnique: async () => rfq },
    rFQItem: { findMany: async () => { itemReads++; return []; } },
    $transaction: async () => { transactions++; throw new Error("Unexpected write"); },
    rFQInvitation: { findUnique: async () => { invitationReads++; return { rfqId: 9, supplierId: 42 }; } },
  };
  const notFound = () => { throw new Error("NOT_FOUND"); };
  const mocks = {
    "@/lib/auth": { auth: async () => session },
    "@/lib/prisma": { prisma },
    "@/lib/db": { prisma },
    "@/lib/rfq-supplier-access": { canSupplierAccessRfq },
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
  assert.equal((await post(request)).status, 403);
  assert.equal(transactions, 0, "No unauthorized quote or invitation writes");
  console.log(`P2-1D passed: ${checks + 3} checks (policy, both server pages, direct POST; no database access).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
