import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { canSupplierAccessRfq } from "../src/lib/rfq-supplier-access";
import { canTransitionRfq } from "../src/lib/rfq-lifecycle";

// Run real server modules with allowlisted mocks. No Prisma client, credentials,
// database, network, or production environment is loaded by this verification.
function load(path: string, mocks: Record<string, unknown>) {
  const exports: Record<string, any> = {};
  const { outputText } = ts.transpileModule(readFileSync(resolve(path), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(outputText, {
    exports, console,
    require: (name: string) => {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
      return mocks[name];
    },
  });
  return exports;
}

let row: any;
let rfq: any;
let user: any;
let session: any;
let invitationWrites = 0;
let quoteWrites = 0;
let transactionCalls = 0;
let beforeUpdate: (() => void) | undefined;
let authorizationWrites = 0;
let lockCalls = 0;
let lockQueue = Promise.resolve();
let buyer: any;
let supplierExists = true;
function reset(status = "PENDING_VIEW", supplierId: number | null = 42) {
  row = { id: 1, token: "invite", rfqId: 9, supplierId, status, viewedAt: null, respondedAt: null,
    reminderCount: 0, lastReminderAt: null, rejectReason: null, externalCompanyName: null };
  rfq = { id: 9, userID: 6, title: "Test RFQ", status: "COLLECTING", visibility: "PUBLIC", matchedSuppliers: null, items: [], quotes: [], images: null, attachments: null };
  buyer = { id: 6, role: "BUYER", buyerCompanyId: null };
  user = { id: 5, role: "SUPPLIER", supplierId: 42, supplier: { id: 42, name: "Test" }, email: "supplier@example.test" };
  session = { user: { id: "5", role: "SUPPLIER", email: user.email } };
  invitationWrites = quoteWrites = transactionCalls = 0;
  beforeUpdate = undefined;
  authorizationWrites = lockCalls = 0;
  lockQueue = Promise.resolve();
  supplierExists = true;
}
function matches(where: any): boolean {
  if (!row) return false;
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === "rfqId_supplierId") return matches(value);
    if (value && typeof value === "object" && "in" in value) return value.in.includes(row[key]);
    return row[key] === value;
  });
}
const db: any = {
  rFQInvitation: {
    findUnique: async ({ where, include }: any) => matches(where) ? { ...row, ...(include?.rfq ? { rfq } : {}) } : null,
    create: async ({ data }: any) => {
      row = { id: 1, status: "PENDING_VIEW", viewedAt: null, respondedAt: null, reminderCount: 0, supplierId: null, ...data };
      invitationWrites++; return { ...row };
    },
    updateMany: async ({ where, data }: any) => {
      beforeUpdate?.();
      beforeUpdate = undefined;
      if (!matches(where)) return { count: 0 };
      for (const [key, value] of Object.entries(data) as [string, any][]) {
        row[key] = value && typeof value === "object" && "increment" in value ? row[key] + value.increment : value;
      }
      invitationWrites++;
      return { count: 1 };
    },
    update: async () => { throw new Error("Unconditional invitation write is forbidden"); },
  },
  user: {
    findUnique: async ({ where }: any) => where.id === 6 ? buyer : user,
    findFirst: async () => user,
    create: async () => ({ id: 5 }),
    update: async () => ({}),
  },
  supplier: { create: async () => ({ id: 42 }), findUnique: async ({ where }: any) => supplierExists ? { id: where.id, users: [] } : null },
  rFQ: {
    findUnique: async ({ where }: any) => where.id === rfq.id ? { ...rfq } : null,
    update: async ({ data }: any) => {
      if ("matchedSuppliers" in data) authorizationWrites++; else quoteWrites++;
      Object.assign(rfq, data); return { ...rfq };
    },
  },
  rFQItem: { findMany: async () => [{ id: 100, quantity: 2 }], count: async () => 1 },
  quote: {
    findFirst: async () => null,
    create: async ({ data }: any) => { assert.equal(data.supplierId, 42); quoteWrites++; return { id: 10 }; },
    update: async () => { quoteWrites++; return { id: 10 }; },
  },
  quoteItem: { create: async () => { quoteWrites++; return {}; } },
  $transaction: async (fn: (tx: any) => Promise<unknown>) => {
    transactionCalls++;
    let release: (() => void) | undefined;
    let snapshot: any;
    const tx = { ...db, $queryRaw: async (strings: TemplateStringsArray, id: number | string) => {
      if (strings.join("?") === 'SELECT "id" FROM "RFQInvitation" WHERE "token" = ? FOR UPDATE') {
        assert.ok(snapshot, "RFQ must be locked before invitation");
        assert.equal(id, row.token); return [{ id: row.id }];
      }
      assert.equal(strings.join("?"), 'SELECT "id" FROM "RFQ" WHERE "id" = ? FOR UPDATE');
      assert.equal(id, rfq.id); lockCalls++;
      const previous = lockQueue;
      lockQueue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      snapshot = { row: row ? { ...row } : null, rfq: { ...rfq }, invitationWrites, authorizationWrites };
      return [{ id }];
    } };
    try { return await fn(tx); }
    catch (error) {
      if (snapshot) { row = snapshot.row; rfq = snapshot.rfq; invitationWrites = snapshot.invitationWrites; authorizationWrites = snapshot.authorizationWrites; }
      throw error;
    } finally { release?.(); }
  },
};
const lifecycle = load("src/lib/rfq-invitation.ts", { crypto: { default: crypto }, "./db": { prisma: db } });
const mocks = {
  "@/lib/prisma": { prisma: db }, "@/lib/db": { prisma: db },
  "@/lib/auth": { auth: async () => session, signIn: async () => ({}) },
  "@/lib/rfq-invitation": lifecycle,
  "@/lib/rfq-supplier-access": { canSupplierAccessRfq },
  "@/lib/rfq-lifecycle": { canTransitionRfq },
  "@/lib/analytics": { writeBusinessEvent: async () => {} },
  "next/server": { NextResponse: { json: (body: unknown, init?: { status: number }) => ({ body, status: init?.status ?? 200 }) } },
  "next/navigation": { redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } },
  "next/cache": { revalidatePath: () => {} },
  "bcryptjs": { default: { hash: async () => "mock-hash" } },
  "next-auth": { AuthError: class extends Error {} },
  "next/link": { default: "Link" },
  "react": { Suspense: "Suspense" },
  "@/components/QuoteForm": { default: "QuoteForm" },
  "@/components/ui/badge": { Badge: "Badge" },
  "react/jsx-runtime": {
    jsx: (type: unknown, props: unknown) => ({ type, props }),
    jsxs: (type: unknown, props: unknown) => ({ type, props }),
  },
};
const post = load("src/app/api/quote/route.ts", mocks).POST;
const register = load("src/app/api/register/route.ts", mocks).POST;
const loginPage = load("src/app/login/page.tsx", mocks).default;
const actions = load("src/app/supplier/invitations/actions.ts", mocks);
const claim = load("src/app/rfq/invite/[token]/actions.ts", mocks).claimInvitationAction;
const invitationPage = load("src/app/rfq/invite/[token]/page.tsx", { ...mocks, "./actions": { claimInvitationAction: claim } }).default;
const quotePage = load("src/app/rfq/[id]/quote/page.tsx", mocks).default;
const request = { formData: async () => new Map([
  ["rfqId", "9"], ["supplierId", "77"], ["invitationToken", "invite"],
  ["items", JSON.stringify([{ rfqItemId: 100, unitPrice: 10 }])],
]) };
const actionForm = new Map([["invitationId", "1"], ["supplierId", "77"], ["reason", "Unavailable"]]);
let passed = 0;
async function test(name: string, fn: () => unknown) {
  reset();
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}

function nodes(node: any): any[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function matched() { rfq.visibility = "MATCHED_SUPPLIERS"; rfq.matchedSuppliers = "[3,7,9]"; }

async function main() {
  await test("A PENDING_VIEW -> VIEWED", async () => {
    assert.ok(await lifecycle.markInvitationViewed(1)); assert.equal(row.status, "VIEWED");
  });
  await test("B VIEWED -> ACCEPTED", async () => {
    row.status = "VIEWED"; assert.ok(await lifecycle.acceptInvitation(1)); assert.equal(row.status, "ACCEPTED");
  });
  await test("C ACCEPTED -> QUOTED", async () => {
    row.status = "ACCEPTED"; assert.ok(await lifecycle.markInvitationQuoted("invite", 9, 42, db)); assert.equal(row.status, "QUOTED");
  });
  for (const [label, status, operation] of [
    ["D", "QUOTED", "acceptInvitation"], ["E", "QUOTED", "rejectInvitation"],
    ["F", "EXPIRED", "acceptInvitation"], ["G", "EXPIRED", "rejectInvitation"],
  ]) await test(`${label} ${status} rejects ${operation}`, async () => {
    row.status = status;
    assert.equal(await lifecycle[operation](1, "Unavailable"), null);
    assert.equal(row.status, status); assert.equal(invitationWrites, 0);
  });
  for (const [label, status, rfqStatus] of [
    ["H", "REJECTED", "COLLECTING"], ["I", "EXPIRED", "COLLECTING"],
    ["J", "ACCEPTED", "CLOSED"], ["K", "ACCEPTED", "EXPIRED"],
  ]) await test(`${label} invitationCanQuote denies ${status}/${rfqStatus}`, () => {
    assert.equal(lifecycle.invitationCanQuote({ status }, rfqStatus), false);
  });
  await test("L unbound invitation binds current supplier", async () => {
    row.supplierId = null; assert.ok(await lifecycle.bindInvitationToSupplier("invite", 42));
    assert.equal(row.supplierId, 42); assert.equal(row.status, "VIEWED");
  });
  await test("M same supplier binding is a no-op", async () => {
    const original = { ...row }; assert.ok(await lifecycle.bindInvitationToSupplier("invite", 42));
    assert.deepEqual(row, original); assert.equal(invitationWrites, 0);
  });
  await test("N different supplier cannot rebind", async () => {
    const original = { ...row }; assert.equal(await lifecycle.bindInvitationToSupplier("invite", 77), null);
    assert.deepEqual(row, original); assert.equal(invitationWrites, 0);
  });
  for (const [label, invitationRfq, invitationSupplier, allowed] of [
    ["O", 9, 42, true], ["P", 99, 42, false], ["Q", 9, 77, false], ["R", 9, null, false],
  ] as const) await test(`${label} POST quote attribution RFQ=${invitationRfq} supplier=${invitationSupplier}`, async () => {
    row.status = "ACCEPTED"; row.rfqId = invitationRfq; row.supplierId = invitationSupplier;
    const response = await post(request);
    assert.equal(response.status, 200); assert.ok(quoteWrites > 0);
    assert.equal(row.status, allowed ? "QUOTED" : "ACCEPTED");
    assert.equal(invitationWrites, allowed ? 1 : 0);
  });
  for (const [label, status, allowed] of [["S", "ACCEPTED", true], ["T", "QUOTED", false], ["U", "EXPIRED", false]] as const) {
    await test(`${label} reminder ${status}`, async () => {
      row.status = status; assert.equal(await lifecycle.remindInvitation(1), allowed);
      assert.equal(row.reminderCount, allowed ? 1 : 0); assert.equal(invitationWrites, allowed ? 1 : 0);
    });
  }
  await test("V/W invitation token cannot bypass visibility; unauthorized POST writes nothing", async () => {
    for (const [visibility, matchedSuppliers] of [["PRIVATE", "[42]"], ["MATCHED_SUPPLIERS", "[77]"], ["MATCHED_SUPPLIERS", null]]) {
      rfq.visibility = visibility; rfq.matchedSuppliers = matchedSuppliers;
      assert.equal((await post(request)).status, 403);
      assert.equal(quoteWrites, 0); assert.equal(invitationWrites, 0); assert.equal(transactionCalls, 0);
    }
  });
  await test("Safe repeated transitions preserve timestamps and rejection reason", async () => {
    for (const [status, fn] of [["VIEWED", "markInvitationViewed"], ["ACCEPTED", "acceptInvitation"], ["REJECTED", "rejectInvitation"]]) {
      row.status = status; row.respondedAt = new Date(0); row.viewedAt = new Date(0); row.rejectReason = "Original";
      const original = { ...row }; assert.ok(await lifecycle[fn](1, "Changed")); assert.deepEqual(row, original);
    }
    row.status = "QUOTED"; assert.ok(await lifecycle.markInvitationQuoted("invite", 9, 42, db));
    assert.equal(invitationWrites, 0);
  });
  await test("Unknown states and REJECTED fail closed for transitions/quote eligibility", async () => {
    for (const status of ["UNKNOWN", "toString", "__proto__", "REJECTED", "EXPIRED"]) {
      row.status = status;
      assert.equal(await lifecycle.acceptInvitation(1), null);
      assert.equal(await lifecycle.markInvitationQuoted("invite", 9, 42, db), null);
      assert.equal(lifecycle.invitationCanQuote(row, "COLLECTING"), false);
    }
    assert.equal(invitationWrites, 0);
  });
  await test("POST terminal invitations do not block otherwise authorized quotes or reopen", async () => {
    for (const status of ["REJECTED", "EXPIRED", "QUOTED", "UNKNOWN"]) {
      row.status = status; assert.equal((await post(request)).status, 200); assert.equal(row.status, status);
    }
    assert.equal(invitationWrites, 0);
  });
  await test("REJECTED reminders retained; batch repeat invitations use the same guard", async () => {
    for (const status of ["PENDING_VIEW", "VIEWED", "ACCEPTED", "REJECTED", "QUOTED", "EXPIRED", "UNKNOWN"]) {
      row.status = status; const originalCount = row.reminderCount;
      const allowed = ["PENDING_VIEW", "VIEWED", "ACCEPTED", "REJECTED"].includes(status);
      const result = await lifecycle.createInvitationsForRFQ(9, 6, [42, 42], []);
      assert.equal(result.reminded, allowed ? 1 : 0); assert.equal(result.failed, allowed ? 0 : 1);
      assert.equal(row.reminderCount, originalCount + (allowed ? 1 : 0)); assert.equal(row.status, status);
    }
  });
  await test("Concurrent terminal transition cannot be overwritten", async () => {
    for (const operation of [() => lifecycle.acceptInvitation(1), () => lifecycle.rejectInvitation(1, "No"), () => lifecycle.markInvitationViewed(1), () => lifecycle.markInvitationQuoted("invite", 9, 42, db)]) {
      row.status = "PENDING_VIEW"; beforeUpdate = () => { row.status = "EXPIRED"; };
      assert.equal(await operation(), null); assert.equal(row.status, "EXPIRED");
    }
    assert.equal(invitationWrites, 0);
  });
  await test("Concurrent binding cannot reassign another supplier", async () => {
    row.supplierId = null; beforeUpdate = () => { row.supplierId = 77; };
    assert.equal(await lifecycle.bindInvitationToSupplier("invite", 42), null);
    assert.equal(row.supplierId, 77); assert.equal(invitationWrites, 0);
  });
  await test("Concurrent attribution binding change fails closed", async () => {
    beforeUpdate = () => { row.supplierId = 77; };
    assert.equal(await lifecycle.markInvitationQuoted("invite", 9, 42, db), null);
    assert.equal(row.status, "PENDING_VIEW"); assert.equal(invitationWrites, 0);
  });
  await test("Malformed binding supplier IDs denied", async () => {
    row.supplierId = null;
    for (const id of [null, undefined, "42", 0, -1, 1.5, NaN, Infinity, 2147483648]) {
      assert.equal(await lifecycle.bindInvitationToSupplier("invite", id), null);
    }
    assert.equal(invitationWrites, 0);
  });
  await test("Supplier actions enforce ownership despite forged form supplierId", async () => {
    row.supplierId = 77;
    for (const operation of ["acceptInvitationAction", "rejectInvitationAction", "markInvitationViewedAction"]) {
      await assert.rejects(() => actions[operation](actionForm), /REDIRECT:\/supplier\/invitations/);
    }
    assert.equal(invitationWrites, 0);
  });
  await test("Supplier actions enforce terminal states server-side", async () => {
    for (const status of ["QUOTED", "EXPIRED"]) {
      row.status = status;
      await assert.rejects(() => actions.acceptInvitationAction(actionForm), /^Error: REDIRECT:\/supplier\/invitations$/);
      assert.equal((await actions.rejectInvitationAction(actionForm)).success, false);
      assert.equal(row.status, status);
    }
    assert.equal(invitationWrites, 0);
  });
  await test("Supplier actions require authenticated supplier user", async () => {
    session = null;
    await assert.rejects(() => actions.acceptInvitationAction(actionForm), /REDIRECT:\/login/);
    session = { user: { email: user.email } }; user.role = "BUYER";
    await assert.rejects(() => actions.rejectInvitationAction(actionForm), /REDIRECT:\/supplier/);
    assert.equal(invitationWrites, 0);
  });
  await test("Registration binds only unbound invitations using the created supplier", async () => {
    user = null;
    rfq.visibility = "MATCHED_SUPPLIERS"; rfq.matchedSuppliers = "[3,7,9]";
    for (const supplierId of [null, 77]) {
      row.supplierId = supplierId; row.status = "PENDING_VIEW"; invitationWrites = 0;
      const response = await register({ json: async () => ({ contactName: "Test", phone: "123", password: "test-password", email: "test@example.test", company: "Test", token: "invite", supplierId: 77 }) });
      assert.equal(response.status, 200); assert.equal(row.supplierId, supplierId === null ? 42 : 77);
      assert.equal(invitationWrites, supplierId === null ? 1 : 0);
      assert.equal(canSupplierAccessRfq(rfq, 42), true);
    }
  });
  await test("Login binds the authenticated supplier and ignores forged supplierId", async () => {
    session = null;
    rfq.visibility = "MATCHED_SUPPLIERS"; rfq.matchedSuppliers = "[3,7,9]";
    function findForm(node: any): any {
      if (!node || typeof node !== "object") return undefined;
      if (node.type === "form") return node;
      return [node.props?.children].flat().map(findForm).find(Boolean);
    }
    const form = findForm(await loginPage({ searchParams: { token: "invite" } }));
    assert.ok(form);
    for (const supplierId of [null, 77]) {
      row.supplierId = supplierId; invitationWrites = 0;
      await assert.rejects(() => form.props.action(new Map([["email", user.email], ["password", "test"], ["supplierId", "77"]])),
        supplierId === null ? /REDIRECT:\/rfq\/9\/quote/ : /^Error: REDIRECT:\/supplier$/);
      assert.equal(row.supplierId, supplierId === null ? 42 : 77);
      assert.equal(invitationWrites, supplierId === null ? 1 : 0);
      assert.equal(canSupplierAccessRfq(rfq, 42), true);
    }
  });
  await test("Grant A/B/C: buyer invitation adds database supplier, preserves IDs, deduplicates and reaches quote", async () => {
    matched(); rfq.matchedSuppliers = "[3,7,9,3]"; row = null;
    const result = await lifecycle.createInvitationsForRFQ(9, 6, [42, 42], []);
    assert.equal(result.created, 1); assert.equal(lockCalls, 1);
    assert.deepEqual(JSON.parse(rfq.matchedSuppliers), [3,7,9,42]);
    assert.equal(canSupplierAccessRfq(rfq, 42), true);
    const page = await quotePage({ params: { id: "9" }, searchParams: { inv: row.token } });
    assert.ok(nodes(page).some((node) => node.type === "QuoteForm"));
    const writes = authorizationWrites;
    await lifecycle.createInvitationsForRFQ(9, 6, [42], []);
    assert.equal(authorizationWrites, writes);
    assert.equal((await post(request)).status, 200);
  });
  await test("Grant D/E: external invitation creation then explicit authenticated binding reaches quote", async () => {
    matched(); row = null;
    await lifecycle.createInvitationsForRFQ(9, 6, [], [{ companyName: "External" }]);
    assert.equal(row.supplierId, null); assert.equal(canSupplierAccessRfq(rfq, 42), false);
    await assert.rejects(() => claim(row.token), /REDIRECT:\/rfq\/9\/quote/);
    assert.equal(row.supplierId, 42); assert.equal(canSupplierAccessRfq(rfq, 42), true);
    const page = await quotePage({ params: { id: "9" }, searchParams: { inv: row.token } });
    assert.ok(nodes(page).some((node) => node.type === "QuoteForm"));
    row.token = "invite";
    assert.equal((await post(request)).status, 200); assert.equal(row.status, "QUOTED");
  });
  await test("Grant F/G: another supplier's token cannot bind or authorize direct POST", async () => {
    matched(); row.supplierId = 77;
    await assert.rejects(() => claim("invite"), /REDIRECT:\/rfq\/invite\/invite/);
    assert.equal(row.supplierId, 77); assert.equal(authorizationWrites, 0);
    assert.equal((await post(request)).status, 403); assert.equal(quoteWrites, 0);
    await assert.rejects(() => quotePage({ params: { id: "9" }, searchParams: { inv: "invite" } }), /NOT_FOUND/);
  });
  await test("Grant H: binding authorizes only the invitation RFQ, never a requested different RFQ", async () => {
    matched(); row.supplierId = null; row.rfqId = rfq.id = 99;
    await assert.rejects(() => claim("invite"), /REDIRECT:\/rfq\/99\/quote/);
    assert.equal(canSupplierAccessRfq(rfq, 42), true);
    rfq = { ...rfq, id: 9, matchedSuppliers: "[3,7,9]" };
    assert.equal((await post(request)).status, 403);
    assert.equal(rfq.matchedSuppliers, "[3,7,9]"); assert.equal(quoteWrites, 0);
  });
  await test("Grant I/J: PRIVATE invitation is rejected; PUBLIC remains unchanged", async () => {
    rfq.visibility = "PRIVATE"; rfq.matchedSuppliers = "[3,7,9]"; row = null;
    await assert.rejects(() => lifecycle.createInvitationsForRFQ(9, 6, [42], []), /私密询价不可邀请供应商/);
    assert.equal(rfq.matchedSuppliers, "[3,7,9]");
    assert.equal(canSupplierAccessRfq(rfq, 42), false);

    rfq.visibility = "PUBLIC"; row = null;
    await lifecycle.createInvitationsForRFQ(9, 6, [42], []);
    assert.equal(rfq.matchedSuppliers, "[3,7,9]");
    assert.equal(canSupplierAccessRfq(rfq, 42), true);
    row.supplierId = null;
    const bound = await lifecycle.bindInvitationToSupplier(row.token, 42);
    assert.equal(Boolean(bound), true);
    assert.equal((await post(request)).status, 200);
    assert.equal(authorizationWrites, 0);
  });
  await test("Grant K: corrupt JSON aborts invitation/binding transaction without replacing data", async () => {
    for (const raw of [null, "[", "null", "{}", "42", '[3,"7"]', "[3,0]", "[3,-1]", "[3,1.5]", "[3,2147483648]", "[3,1e999]"]) {
      matched(); rfq.matchedSuppliers = raw; row.supplierId = null;
      const original = { ...row };
      await assert.rejects(() => lifecycle.bindInvitationToSupplier(row.token, 42), /授权数据无效/);
      assert.deepEqual(row, original); assert.equal(rfq.matchedSuppliers, raw);
      row = null;
      await assert.rejects(() => lifecycle.createInvitationsForRFQ(9, 6, [42], []), /授权数据无效/);
      assert.equal(row, null); assert.equal(rfq.matchedSuppliers, raw);
      reset();
    }
  });
  await test("Grant L: overlapping transactions lock before reading and retain both additions", async () => {
    matched(); row = null;
    const results = await Promise.all([
      lifecycle.createInvitationsForRFQ(9, 6, [42], []),
      lifecycle.createInvitationsForRFQ(9, 6, [77], []),
    ]);
    assert.equal(results.every((result: any) => result.created === 1), true);
    assert.equal(lockCalls, 2);
    assert.deepEqual(JSON.parse(rfq.matchedSuppliers), [3,7,9,42,77]);
    assert.equal(canSupplierAccessRfq(rfq, 42), true); assert.equal(canSupplierAccessRfq(rfq, 77), true);
  });
  await test("Grant N/O: terminal/rejected binding never adds authority or changes lifecycle", async () => {
    matched();
    for (const status of ["QUOTED", "EXPIRED", "REJECTED", "UNKNOWN"]) {
      row.status = status; row.supplierId = null;
      assert.equal(await lifecycle.bindInvitationToSupplier("invite", 42), null);
      row.supplierId = 42; await lifecycle.bindInvitationToSupplier("invite", 42);
      assert.equal(row.status, status); assert.equal(authorizationWrites, 0);
      await lifecycle.createInvitationsForRFQ(9, 6, [42], []);
      assert.equal(authorizationWrites, 0); assert.equal(row.status, status);
    }
  });
  await test("Grant requires RFQ ownership and a real valid supplier record", async () => {
    matched(); row = null;
    buyer.id = 123;
    await assert.rejects(() => lifecycle.createInvitationsForRFQ(9, 6, [42], []), /无权邀请/);
    buyer.id = 6; supplierExists = false;
    const missing = await lifecycle.createInvitationsForRFQ(9, 6, [42], []);
    assert.equal(missing.failed, 1); assert.equal(row, null);
    supplierExists = true;
    const invalid = await lifecycle.createInvitationsForRFQ(9, 6, [0, -1, 1.5, 2147483648, "42"], []);
    assert.equal(invalid.failed, 5); assert.equal(authorizationWrites, 0);
  });
  await test("UI distinguishes unbound, own, another supplier, and unquoteable invitations", async () => {
    matched();
    for (const [supplierId, status, expected, hasForm, hasQuote] of [
      [null, "PENDING_VIEW", "该邀请尚未绑定", true, false],
      [42, "VIEWED", "该邀请已关联到您的账号", false, true],
      [77, "VIEWED", "该邀请已关联其他供应商", false, false],
      [42, "EXPIRED", "该邀请已失效", false, false],
      [42, "REJECTED", "该邀请已失效", false, false],
    ] as const) {
      row.supplierId = supplierId; row.status = status; rfq.matchedSuppliers = "[3,7,9,42]";
      const page = await invitationPage({ params: { token: "invite" } });
      assert.ok(JSON.stringify(page).includes(expected));
      assert.equal(nodes(page).some((node) => node.type === "form"), hasForm);
      assert.equal(nodes(page).some((node) => node.props?.href?.startsWith("/rfq/9/quote")), hasQuote);
      assert.equal(JSON.stringify(page).includes("报价后将自动关联"), false);
    }
  });
  console.log(`P2-1E passed: ${passed} test groups (lifecycle, explicit authorization, concurrency, ownership, UI; no database access).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
