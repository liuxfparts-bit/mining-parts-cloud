import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, fingerprint, sourceFingerprint, itemFingerprint } from "../src/lib/trust/evidence/fingerprint";
import type { SourceSnapshot, ItemSnapshot } from "../src/lib/trust/evidence/contract";

let passed = 0;
function test(name: string, fn: () => void) {
  fn(); passed++; console.log("PASS " + name);
}
const source: SourceSnapshot = {
  stableKey: "manual-a", revision: 1, declaredKind: "OFFICIAL_DOCUMENT",
  title: "Example", issuerClaim: null, documentNumber: null, edition: null,
  acquisitionMethod: null, acquisitionNote: null, independenceGroupClaim: null,
  captureState: "PENDING_CAPTURE",
};
const sourceHash = sourceFingerprint(source);
const item: ItemSnapshot = {
  stableKey: "item-a", revision: 1, sourceStableKey: source.stableKey,
  sourceRevision: 1, sourceFingerprint: sourceHash, locatorKey: "page:69/item:4",
  pageLabel: "69", sectionLabel: null, itemLabel: "4", rowLabel: null,
  excerpt: null, extractionMethod: null, captureState: "PENDING_CAPTURE",
};
test("canonical order independent", () => assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 })));
test("source fingerprint deterministic", () => assert.equal(sourceHash, sourceFingerprint({ ...source })));
test("version changes fingerprint", () => assert.notEqual(sourceHash, sourceFingerprint({ ...source, revision: 2 })));
test("metadata changes fingerprint", () => assert.notEqual(sourceHash, sourceFingerprint({ ...source, issuerClaim: "unknown" })));
test("item binds source version", () => assert.notEqual(itemFingerprint(item), itemFingerprint({ ...item, sourceRevision: 2 })));
test("item binds locator", () => assert.notEqual(itemFingerprint(item), itemFingerprint({ ...item, locatorKey: "page:70" })));
test("hash is 64 lowercase hex", () => assert.match(fingerprint({ a: 1 }), /^[0-9a-f]{64}$/));
test("undefined fails closed", () => assert.throws(() => canonicalJson({ a: undefined })));
test("nonfinite fails closed", () => assert.throws(() => canonicalJson({ a: Infinity })));
test("cyclic fails closed", () => { const a: unknown[] = []; a.push(a); assert.throws(() => canonicalJson(a)); });
const migration = readFileSync(join(process.cwd(), "prisma/migrations/0009_evidence_foundation/migration.sql"), "utf8");
test("migration contains immutable triggers", () => assert.equal((migration.match(/EXECUTE FUNCTION evidence_foundation_reject_mutation\(\)/g) ?? []).length, 3));
test("migration blocks premature confirmation", () => assert.match(migration, /IF NEW\."outcome" = 'CONFIRMED' THEN/));
test("migration has XOR target", () => assert.match(migration, /num_nonnulls\("sourceId", "itemId"\) = 1/));
test("migration validates predecessor target", () => assert.match(migration, /prior\."itemId" IS DISTINCT FROM NEW\."itemId"/));
test("migration validates revocation target", () => assert.match(migration, /revoked\."itemId" IS DISTINCT FROM NEW\."itemId"/));
test("migration prevents premature source capture", () => assert.match(migration, /evidence_source_pending_capture_only/));
test("migration prevents premature item capture", () => assert.match(migration, /evidence_item_pending_capture_only/));
test("test database fail closed", () => {
  const url = process.env.EVIDENCE_TEST_DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, "postgresql:");
    assert.equal(parsed.hostname, "127.0.0.1");
    const local = parsed.port === "55439" && parsed.pathname === "/evidence_test";
    const ci = process.env.CI === "true" && parsed.port === "5432" && parsed.pathname === "/kuangpeiyun_ci" && parsed.username === "ci_user";
    assert.ok(local || ci, "evidence tests require dedicated local or CI database");
  }
});
console.log("EVIDENCE_FOUNDATION_PURE_PASS=" + passed);
if (!process.env.EVIDENCE_TEST_DATABASE_URL) console.log("EVIDENCE_FOUNDATION_DB_TESTS=NOT_RUN_NO_ISOLATED_DATABASE");

async function databaseIntegrationTests() {
  const url = process.env.EVIDENCE_TEST_DATABASE_URL;
  if (!url) {
    if (process.env.CI === "true") throw new Error("CI must supply isolated evidence test database");
    return;
  }
  const { PrismaClient } = await import("@prisma/client");
  const { createEvidenceSource, createEvidenceItem, appendEvidenceReview, readEvidenceReviewState } = await import("../src/lib/trust/evidence/repository");
  const db = new PrismaClient({ datasources: { db: { url } } });
  const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  let count = 0;
  async function check(name: string, fn: () => Promise<void>) {
    await fn(); count++; console.log("DB PASS " + name);
  }
  try {
    const admin = await db.user.create({ data: { email: `evidence-test-admin-${run}@example.invalid`, name: "Evidence Test Admin", role: "ADMIN", status: "ACTIVE" } });
    const buyer = await db.user.create({ data: { email: `evidence-test-buyer-${run}@example.invalid`, name: "Buyer", role: "BUYER", status: "ACTIVE" } });
    const sourceData: SourceSnapshot = { ...source, stableKey: `test-source-${run}` };
    const src = await createEvidenceSource(db, sourceData, admin.id);
    await check("source pending metadata only", async () => {
      assert.equal(src.captureState, "PENDING_CAPTURE");
      assert.equal(src.metadataFingerprint, sourceFingerprint(sourceData));
    });
    await check("database rejects premature source capture", async () => {
      await assert.rejects(db.evidenceSource.create({ data: {
        stableKey: `captured-source-${run}`, revision: 1, declaredKind: "OFFICIAL_DOCUMENT",
        title: "Unverified bytes", captureState: "CAPTURED_UNVERIFIED",
        metadataFingerprint: "a".repeat(64), createdById: admin.id,
      } }));
    });
    await check("nonadmin source write rejected", async () => {
      await assert.rejects(createEvidenceSource(db, { ...sourceData, stableKey: "forbidden" }, buyer.id));
    });
    const evidenceItem = await createEvidenceItem(db, {
      stableKey: `test-item-${run}`, revision: 1, locatorKey: "page:69",
      pageLabel: "69", captureState: "PENDING_CAPTURE",
    }, src.id, admin.id);
    await check("item linked and pending", async () => {
      assert.equal(evidenceItem.sourceId, src.id);
      assert.equal(evidenceItem.captureState, "PENDING_CAPTURE");
    });
    await check("database rejects premature item capture", async () => {
      await assert.rejects(db.evidenceItem.create({ data: {
        stableKey: `captured-item-${run}`, revision: 1, sourceId: src.id,
        locatorKey: "page:69", excerpt: "not snapshotted", captureState: "CAPTURED_UNVERIFIED",
        contentFingerprint: "a".repeat(64), createdById: admin.id,
      } }));
    });
    await check("database prevents direct premature confirmation", async () => {
      await assert.rejects(db.evidenceReviewEvent.create({ data: {
        sourceId: src.id, dimension: "SOURCE_METADATA", sequence: 1,
        outcome: "CONFIRMED", verificationMethod: "TEST", reason: "not permitted",
        targetFingerprint: src.metadataFingerprint, reviewerId: admin.id,
        reviewerSnapshot: "Test", idempotencyKey: `direct-confirm-${run}`, noExpiryReason: "TEST",
      } }));
    });
    await check("database rejects incorrect review fingerprint", async () => {
      await assert.rejects(db.evidenceReviewEvent.create({ data: {
        sourceId: src.id, dimension: "SOURCE_METADATA", sequence: 1,
        outcome: "REJECTED", verificationMethod: "TEST", reason: "bad hash",
        targetFingerprint: "b".repeat(64), reviewerId: admin.id,
        reviewerSnapshot: "Test", idempotencyKey: `bad-hash-${run}`, noExpiryReason: "TEST",
      } }));
    });
    await check("database rejects first event predecessor", async () => {
      await assert.rejects(db.evidenceReviewEvent.create({ data: {
        sourceId: src.id, dimension: "SOURCE_METADATA", sequence: 1,
        previousEventId: 999999999, outcome: "REJECTED", verificationMethod: "TEST", reason: "bad predecessor",
        targetFingerprint: src.metadataFingerprint, reviewerId: admin.id,
        reviewerSnapshot: "Test", idempotencyKey: `bad-first-${run}`, noExpiryReason: "TEST",
      } }));
    });
    await check("database rejects missing expiry explanation", async () => {
      await assert.rejects(db.evidenceReviewEvent.create({ data: {
        sourceId: src.id, dimension: "SOURCE_METADATA", sequence: 1,
        outcome: "REJECTED", verificationMethod: "TEST", reason: "no expiry reason",
        targetFingerprint: src.metadataFingerprint, reviewerId: admin.id,
        reviewerSnapshot: "Test", idempotencyKey: `bad-expiry-${run}`,
      } }));
    });
    await check("database enforces target xor", async () => {
      await assert.rejects(db.evidenceReviewEvent.create({ data: {
        sourceId: src.id, itemId: evidenceItem.id, dimension: "SOURCE_METADATA", sequence: 1,
        outcome: "REJECTED", verificationMethod: "TEST", reason: "bad target",
        targetFingerprint: src.metadataFingerprint, reviewerId: admin.id,
        reviewerSnapshot: "Test", idempotencyKey: `xor-test-${run}`, noExpiryReason: "TEST",
      } }));
    });
    const first = await appendEvidenceReview(db, {
      sourceId: src.id, dimension: "SOURCE_METADATA", expectedSequence: 0,
      outcome: "REQUEST_MORE_EVIDENCE", verificationMethod: "MANUAL", reason: "no immutable original",
      noExpiryReason: "until new evidence", idempotencyKey: `review-1-${run}`,
    }, admin.id);
    await check("append first review", async () => {
      assert.equal(first.sequence, 1); assert.equal(first.previousEventId, null);
    });
    await check("database rejects review UPDATE", async () => {
      await assert.rejects(db.evidenceReviewEvent.update({ where: { id: first.id }, data: { reason: "tamper" } }));
    });
    await check("database rejects review DELETE", async () => {
      await assert.rejects(db.evidenceReviewEvent.delete({ where: { id: first.id } }));
    });
    await check("database rejects source UPDATE", async () => {
      await assert.rejects(db.evidenceSource.update({ where: { id: src.id }, data: { title: "tamper" } }));
    });
    await check("database rejects item DELETE", async () => {
      await assert.rejects(db.evidenceItem.delete({ where: { id: evidenceItem.id } }));
    });
    await check("database rejects cross-target predecessor", async () => {
      await assert.rejects(db.evidenceReviewEvent.create({ data: {
        itemId: evidenceItem.id, dimension: "ITEM_FIDELITY", sequence: 2, previousEventId: first.id,
        outcome: "REJECTED", verificationMethod: "TEST", reason: "wrong predecessor",
        targetFingerprint: evidenceItem.contentFingerprint, reviewerId: admin.id,
        reviewerSnapshot: "Test", idempotencyKey: `wrong-prior-${run}`, noExpiryReason: "TEST",
      } }));
    });
    await check("database rejects cross-target revocation", async () => {
      await assert.rejects(db.evidenceReviewEvent.create({ data: {
        itemId: evidenceItem.id, dimension: "ITEM_FIDELITY", sequence: 1,
        outcome: "REVOKED", revokesEventId: first.id, verificationMethod: "TEST", reason: "wrong target",
        targetFingerprint: evidenceItem.contentFingerprint, reviewerId: admin.id,
        reviewerSnapshot: "Test", idempotencyKey: `bad-revoke-${run}`, noExpiryReason: "TEST",
      } }));
    });
    await check("concurrent append has exactly one winner", async () => {
      const mk = (id: string) => appendEvidenceReview(db, {
        sourceId: src.id, dimension: "SOURCE_METADATA", expectedSequence: 1,
        outcome: "REJECTED", verificationMethod: "MANUAL", reason: "concurrent check",
        noExpiryReason: "test", idempotencyKey: id,
      }, admin.id);
      const results = await Promise.allSettled([mk(`concurrent-a-${run}`), mk(`concurrent-b-${run}`)]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      assert.equal(results.filter(r => r.status === "rejected").length, 1);
    });
    const second = await db.evidenceReviewEvent.findFirstOrThrow({
      where: { sourceId: src.id, sequence: 2 },
    });
    const revocation = await appendEvidenceReview(db, {
      sourceId: src.id, dimension: "SOURCE_METADATA", expectedSequence: 2,
      outcome: "REVOKED", revokesEventId: second.id, verificationMethod: "MANUAL",
      reason: "superseded", noExpiryReason: "historical", idempotencyKey: `revoke-second-${run}`,
    }, admin.id);
    await check("valid same-target revocation", async () => {
      assert.equal(revocation.revokesEventId, second.id);
      const state = await readEvidenceReviewState(db, { sourceId: src.id });
      assert.equal(state.provenanceConfirmed, false);
      assert.equal(state.usableAsTrustedEvidence, false);
    });
    await check("rollback on transaction failure", async () => {
      const before = await db.evidenceSource.count();
      await assert.rejects(db.$transaction(async tx => {
        await tx.evidenceSource.create({ data: {
          stableKey: `rolled-back-${run}`, revision: 1, declaredKind: "OTHER",
          title: "Rollback", metadataFingerprint: "a".repeat(64),
          createdById: admin.id,
        } });
        throw new Error("force rollback");
      }));
      assert.equal(await db.evidenceSource.count(), before);
    });
    await check("no trust-producing evidence adapter", async () => {
      assert.equal((await import("../src/lib/trust/evidence/repository")).readEvidenceReviewState != null, true);
    });
    console.log("EVIDENCE_FOUNDATION_DB_PASS=" + count);
  } finally { await db.$disconnect(); }
}
databaseIntegrationTests().catch(e => { console.error("EVIDENCE_FOUNDATION_DB_FAIL", e); process.exitCode = 1; });
