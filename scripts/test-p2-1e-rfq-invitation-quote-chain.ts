import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { canSupplierAccessRfq } from "../src/lib/rfq-supplier-access";

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
function reset(status = "PENDING_VIEW", supplierId: number | null = 42) {
  row = { id: 1, token: "invite", rfqId: 9, supplierId, status, viewedAt: null, respondedAt: null,
    reminderCount: 0, lastReminderAt: null, rejectReason: null, externalCompanyName: null };
  rfq = { id: 9, title: "Test RFQ", status: "COLLECTING", visibility: "PUBLIC", matchedSuppliers: null };
  user = { id: 5, role: "SUPPLIER", supplierId: 42, email: "supplier@example.test" };
  session = { user: { id: "5", role: "SUPPLIER", email: user.email } };
  invitationWrites = quoteWrites = transactionCalls = 0;
  beforeUpdate = undefined;
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
    findUnique: async ({ where }: any) => matches(where) ? { ...row } : null,
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
    findUnique: async () => user,
    findFirst: async () => user,
    create: async () => ({ id: 5 }),
    update: async () => ({}),
  },
  supplier: { create: async () => ({ id: 42 }) },
  rFQ: { findUnique: async () => rfq, update: async () => { quoteWrites++; return rfq; } },
  rFQItem: { findMany: async () => [{ id: 100, quantity: 2 }], count: async () => 1 },
  quote: {
    findFirst: async () => null,
    create: async ({ data }: any) => { assert.equal(data.supplierId, 42); quoteWrites++; return { id: 10 }; },
    update: async () => { quoteWrites++; return { id: 10 }; },
  },
  quoteItem: { create: async () => { quoteWrites++; return {}; } },
  $transaction: async (fn: (tx: any) => Promise<unknown>) => { transactionCalls++; return fn(db); },
};
const lifecycle = load("src/lib/rfq-invitation.ts", { crypto: { default: crypto }, "./db": { prisma: db } });
const mocks = {
  "@/lib/prisma": { prisma: db }, "@/lib/db": { prisma: db },
  "@/lib/auth": { auth: async () => session, signIn: async () => ({}) },
  "@/lib/rfq-invitation": lifecycle,
  "@/lib/rfq-supplier-access": { canSupplierAccessRfq },
  "next/server": { NextResponse: { json: (body: unknown, init?: { status: number }) => ({ body, status: init?.status ?? 200 }) } },
  "next/navigation": { redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } },
  "next/cache": { revalidatePath: () => {} },
  "bcryptjs": { default: { hash: async () => "mock-hash" } },
  "next-auth": { AuthError: class extends Error {} },
  "react/jsx-runtime": {
    jsx: (type: unknown, props: unknown) => ({ type, props }),
    jsxs: (type: unknown, props: unknown) => ({ type, props }),
  },
};
const post = load("src/app/api/quote/route.ts", mocks).POST;
const register = load("src/app/api/register/route.ts", mocks).POST;
const loginPage = load("src/app/login/page.tsx", mocks).default;
const actions = load("src/app/supplier/invitations/actions.ts", mocks);
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
      const result = await lifecycle.createInvitationsForRFQ(9, 5, [42, 42], []);
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
    for (const supplierId of [null, 77]) {
      row.supplierId = supplierId; row.status = "PENDING_VIEW"; invitationWrites = 0;
      const response = await register({ json: async () => ({ contactName: "Test", phone: "123", password: "test-password", email: "test@example.test", company: "Test", token: "invite", supplierId: 77 }) });
      assert.equal(response.status, 200); assert.equal(row.supplierId, supplierId === null ? 42 : 77);
      assert.equal(invitationWrites, supplierId === null ? 1 : 0);
    }
  });
  await test("Login binds the authenticated supplier and ignores forged supplierId", async () => {
    session = null;
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
    }
  });
  console.log(`P2-1E passed: ${passed} test groups (A-W, concurrency, ownership, login/registration; no database access).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
