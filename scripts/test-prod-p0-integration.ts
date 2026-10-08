import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const source = readFileSync("src/app/api/rfq/route.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports: Record<string, any> = {};
runInNewContext(js, { exports, require: (name: string) => {
  assert.equal(name, "next/server", "legacy RFQ endpoint must not import DB");
  return { NextResponse: { json: (body: unknown, init: any) => ({ body, ...init }) } };
} });
async function main() {
const result = await exports.GET();
assert.equal(result.status, 410);
assert.equal(result.headers["Cache-Control"], "no-store");
assert.equal(JSON.stringify(result.body).includes("contactName"), false);
const detail = readFileSync("src/app/rfq/[id]/page.tsx", "utf8");
assert.match(detail, /canSeeAllQuotes\s*\?\s*rfq\.contactName\s*:/, "contact masking required");
const list = readFileSync("src/app/rfqs/page.tsx", "utf8");
assert.match(list, /visibility:\s*"PUBLIC",\s*businessAuthenticity:\s*"REAL"/, "REAL-only public RFQ list required");
const upload = readFileSync("src/app/uploads/[...path]/route.ts", "utf8");
assert.match(upload, /canReadStoredQuoteAttachment\(quote, reader\)/);
console.log("Production P0 integration: PASS (410/no-store, contact mask, REAL-only list, private quote)");

}
main().catch(e => { console.error(e); process.exitCode = 1; });
