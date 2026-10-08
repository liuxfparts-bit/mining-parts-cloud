import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { canSupplierAccessRfq } from "../src/lib/rfq-supplier-access";

async function main() {
  const api = readFileSync(resolve("src/app/api/rfq/route.ts"), "utf8");
  const js = ts.transpileModule(api, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(js, {
    exports,
    require: (name: string) => {
      assert.equal(name, "next/server", "Legacy GET must not access database");
      return { NextResponse: { json: (body: unknown, options: any) => ({ body, status: options?.status, headers: options?.headers }) } };
    },
  });
  const response = await exports.GET();
  assert.equal(response.status, 410);
  assert.equal(response.headers["Cache-Control"], "no-store");

  const list = readFileSync(resolve("src/app/rfqs/page.tsx"), "utf8");
  assert.match(list, /const where: Prisma\.RFQWhereInput = \{ visibility: "PUBLIC" \}/);
  const detail = readFileSync(resolve("src/app/rfq/[id]/page.tsx"), "utf8");
  assert.match(detail, /canSupplierAccessRfq\(rfq, mySupplierId\)/);
  assert.match(detail, /if \(!canSeeAllQuotes &&/);
  assert.match(detail, /notFound\(\)/);
  assert.match(detail, /canSeeAllQuotes \? rfq\.contactName/);

  const cases: Array<[string, string, string | null, number | null, boolean]> = [
    ["anonymous public", "PUBLIC", null, null, true],
    ["anonymous private", "PRIVATE", null, null, false],
    ["uninvited matched", "MATCHED_SUPPLIERS", "[7]", 8, false],
    ["matched supplier", "MATCHED_SUPPLIERS", "[7]", 7, true],
    ["matched malformed", "MATCHED_SUPPLIERS", "[7,\\"8\\"]", 7, false],
    ["private supplier", "PRIVATE", "[7]", 7, false],
    ["unknown visibility", "OTHER", null, 7, false],
  ];
  for (const [name, visibility, matchedSuppliers, supplierId, expected] of cases) {
    const visible = visibility === "PUBLIC" ||
      (supplierId !== null && canSupplierAccessRfq({ visibility, matchedSuppliers }, supplierId));
    assert.equal(visible, expected, name);
  }
  console.log("PASS: legacy API, listing, detail policy, contact masking, 7 visibility cases");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
