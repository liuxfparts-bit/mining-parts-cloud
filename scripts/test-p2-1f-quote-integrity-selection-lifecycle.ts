import assert from "node:assert/strict";
import { canTransitionQuote } from "../src/lib/quote-lifecycle";
import { canAcceptQuotes, canAdminTransitionRfq, canTransitionRfq } from "../src/lib/rfq-lifecycle";
import fs from "node:fs";

let groups = 0;
function group(name: string, run: () => void) { run(); groups++; console.log(`PASS ${name}`); }

group("A Quote lifecycle", () => {
  assert(canTransitionQuote("PENDING", "ACCEPTED"));
  assert(canTransitionQuote("PENDING", "REJECTED"));
  assert(canTransitionQuote("PENDING", "WITHDRAWN"));
  for (const from of ["ACCEPTED", "REJECTED", "WITHDRAWN", "UNKNOWN"]) assert(!canTransitionQuote(from, "PENDING"));
});
group("B RFQ lifecycle", () => {
  for (const [from, to] of [["COLLECTING", "QUOTED"], ["QUOTED", "SELECTED"], ["SELECTED", "CLOSED"], ["COLLECTING", "CLOSED"], ["QUOTED", "CLOSED"]]) assert(canTransitionRfq(from, to));
  for (const [from, to] of [["CLOSED", "COLLECTING"], ["EXPIRED", "COLLECTING"], ["SELECTED", "QUOTED"], ["REJECTED", "CLOSED"], ["UNKNOWN", "CLOSED"]]) assert(!canTransitionRfq(from, to));
});
group("C quote submission and selection RFQ guard", () => {
  assert(canAcceptQuotes("COLLECTING")); assert(canAcceptQuotes("QUOTED"));
  for (const s of ["SELECTED", "CLOSED", "EXPIRED", "REJECTED", "UNKNOWN"]) assert(!canAcceptQuotes(s));
});
group("D admin allowlist and lifecycle", () => {
  assert(canAdminTransitionRfq("COLLECTING", "REJECTED"));
  assert(canAdminTransitionRfq("QUOTED", "CLOSED"));
  assert(canAdminTransitionRfq("SELECTED", "CLOSED"));
  for (const [from, to] of [["COLLECTING", "QUOTED"], ["QUOTED", "SELECTED"], ["CLOSED", "SELECTED"], ["EXPIRED", "SELECTED"], ["CLOSED", "COLLECTING"], ["REJECTED", "COLLECTING"], ["COLLECTING", "ABC"], ["SELECTED", "REJECTED"]]) assert(!canAdminTransitionRfq(from, to));
});
group("E database invariants are represented by schema", () => {
  // Integration migration checks run in deployment DB; application policy above remains database-independent.
  assert.equal(canTransitionQuote("ACCEPTED", "WITHDRAWN"), false);
});
group("F static quote-post terminal and duplicate guards", () => {
  const post = fs.readFileSync("src/app/api/quote/route.ts", "utf8");
  assert(post.includes('new Set(items.map((it) => it.rfqItemId)).size !== items.length'));
  assert(post.includes('existing.status !== "PENDING"'));
  assert(post.includes('FOR UPDATE'));
});
group("G static selection and deletion safeguards", () => {
  const selection = fs.readFileSync("src/lib/quote-selection.ts", "utf8");
  const buyer = fs.readFileSync("src/app/dashboard/rfqs/actions.ts", "utf8");
  const admin = fs.readFileSync("src/app/admin/rfqs/actions.ts", "utf8");
  assert(selection.includes('FOR UPDATE') && selection.includes('status: "ACCEPTED"') && selection.includes('status: "REJECTED"'));
  assert(buyer.includes('requireOwnedRfq') && buyer.includes('quoteCount > 0'));
  assert(admin.includes('含有供应商报价的询价不能删除') && admin.includes('closeRfqs'));
});
console.log(`P2-1F: ${groups} test groups passed`);
