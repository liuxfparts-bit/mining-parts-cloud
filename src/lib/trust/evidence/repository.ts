import { Prisma, PrismaClient } from "@prisma/client";
import type { ItemSnapshot, SourceSnapshot, ReviewDimension, ReviewOutcome } from "./contract";
import { itemFingerprint, sourceFingerprint } from "./fingerprint";

type Db = PrismaClient;
const isolationLevel = Prisma.TransactionIsolationLevel.Serializable;
function assertKey(value: string, field: string): void {
  if (!value || !value.trim()) throw new Error(field + " is required");
}
function assertRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("invalid revision");
}
async function requireAdmin(tx: Prisma.TransactionClient, userId: number) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, status: true } });
  if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") throw new Error("active ADMIN required");
  return user;
}
export async function createEvidenceSource(db: Db, data: SourceSnapshot, actorId: number) {
  assertKey(data.stableKey, "stableKey"); assertKey(data.title, "title"); assertKey(data.declaredKind, "declaredKind");
  assertRevision(data.revision);
  if (data.captureState !== "PENDING_CAPTURE") throw new Error("3B-1 cannot capture verified source bytes");
  const normalized: SourceSnapshot = {
    stableKey: data.stableKey, revision: data.revision, declaredKind: data.declaredKind,
    title: data.title, issuerClaim: data.issuerClaim ?? null,
    documentNumber: data.documentNumber ?? null, edition: data.edition ?? null,
    acquisitionMethod: data.acquisitionMethod ?? null, acquisitionNote: data.acquisitionNote ?? null,
    independenceGroupClaim: data.independenceGroupClaim ?? null, captureState: "PENDING_CAPTURE",
  };
  return db.$transaction(async tx => {
    await requireAdmin(tx, actorId);
    return tx.evidenceSource.create({ data: { ...normalized, metadataFingerprint: sourceFingerprint(normalized), createdById: actorId } });
  }, { isolationLevel });
}
export async function createEvidenceItem(db: Db, data: Omit<ItemSnapshot, "sourceStableKey" | "sourceRevision" | "sourceFingerprint">, sourceId: number, actorId: number) {
  assertKey(data.stableKey, "stableKey"); assertKey(data.locatorKey, "locatorKey"); assertRevision(data.revision);
  if (data.captureState !== "PENDING_CAPTURE") throw new Error("3B-1 item content capture requires private attachment slice");
  return db.$transaction(async tx => {
    await requireAdmin(tx, actorId);
    const source = await tx.evidenceSource.findUniqueOrThrow({ where: { id: sourceId } });
    const normalized: ItemSnapshot = {
      ...data, pageLabel: data.pageLabel ?? null, sectionLabel: data.sectionLabel ?? null,
      itemLabel: data.itemLabel ?? null, rowLabel: data.rowLabel ?? null,
      excerpt: data.excerpt ?? null, extractionMethod: data.extractionMethod ?? null,
      sourceStableKey: source.stableKey, sourceRevision: source.revision,
      sourceFingerprint: source.metadataFingerprint, captureState: "PENDING_CAPTURE",
    };
    return tx.evidenceItem.create({
      data: {
        stableKey: normalized.stableKey, revision: normalized.revision, sourceId,
        locatorKey: normalized.locatorKey, pageLabel: normalized.pageLabel,
        sectionLabel: normalized.sectionLabel, itemLabel: normalized.itemLabel,
        rowLabel: normalized.rowLabel, excerpt: normalized.excerpt,
        extractionMethod: normalized.extractionMethod, captureState: normalized.captureState,
        contentFingerprint: itemFingerprint(normalized), createdById: actorId,
      }
    });
  }, { isolationLevel });
}
export interface AppendReviewInput {
  dimension: ReviewDimension;
  sourceId?: number;
  itemId?: number;
  expectedSequence: number; // 0 for first event
  outcome: ReviewOutcome;
  verificationMethod: string;
  reason: string;
  validUntil?: Date | null;
  noExpiryReason?: string | null;
  revokesEventId?: number;
  idempotencyKey: string;
}
export async function appendEvidenceReview(db: Db, input: AppendReviewInput, reviewerId: number) {
  if (Number.isSafeInteger(input.expectedSequence) === false || input.expectedSequence < 0) throw new Error("invalid expectedSequence");
  if ((input.sourceId == null) === (input.itemId == null)) throw new Error("exactly one target required");
  if ((input.sourceId != null ? "SOURCE_METADATA" : "ITEM_FIDELITY") !== input.dimension) throw new Error("review dimension mismatch");
  if (input.outcome === "CONFIRMED") throw new Error("3B-1 cannot confirm provenance or fidelity without immutable source bytes");
  if ((input.outcome === "REVOKED") !== (input.revokesEventId != null)) throw new Error("revocation reference mismatch");
  assertKey(input.reason, "reason"); assertKey(input.verificationMethod, "verificationMethod"); assertKey(input.idempotencyKey, "idempotencyKey");
  if (input.validUntil && input.noExpiryReason) throw new Error("expiry fields conflict");
  if (!input.validUntil && !input.noExpiryReason?.trim()) throw new Error("expiry or noExpiryReason required");
  return db.$transaction(async tx => {
    const reviewer = await requireAdmin(tx, reviewerId);
    const target = input.sourceId != null
      ? await tx.evidenceSource.findUniqueOrThrow({ where: { id: input.sourceId } })
      : await tx.evidenceItem.findUniqueOrThrow({ where: { id: input.itemId! } });
    const targetFingerprint = "metadataFingerprint" in target ? target.metadataFingerprint : target.contentFingerprint;
    const previous = await tx.evidenceReviewEvent.findFirst({
      where: { sourceId: input.sourceId ?? null, itemId: input.itemId ?? null, dimension: input.dimension },
      orderBy: { sequence: "desc" },
    });
    if ((previous?.sequence ?? 0) !== input.expectedSequence) throw new Error("stale review sequence");
    if (input.revokesEventId != null) {
      const revoked = await tx.evidenceReviewEvent.findUniqueOrThrow({ where: { id: input.revokesEventId } });
      if (revoked.sourceId !== (input.sourceId ?? null) || revoked.itemId !== (input.itemId ?? null)
        || revoked.dimension !== input.dimension) throw new Error("cross-target revocation");
    }
    return tx.evidenceReviewEvent.create({
      data: {
        sourceId: input.sourceId ?? null, itemId: input.itemId ?? null,
        dimension: input.dimension, sequence: input.expectedSequence + 1,
        previousEventId: previous?.id ?? null, revokesEventId: input.revokesEventId ?? null,
        outcome: input.outcome, verificationMethod: input.verificationMethod, reason: input.reason,
        targetFingerprint, validUntil: input.validUntil ?? null, noExpiryReason: input.noExpiryReason ?? null,
        reviewerId, reviewerSnapshot: reviewer.name, idempotencyKey: input.idempotencyKey,
      },
    });
  }, { isolationLevel });
}
// Deliberately no toEvidenceFacts()/provenanceConfirmed API in Phase 3B-1.

export async function readEvidenceReviewState(db: Db, target: { sourceId: number } | { itemId: number }, at: Date = new Date()) {
  const sourceId = "sourceId" in target ? target.sourceId : null;
  const itemId = "itemId" in target ? target.itemId : null;
  const dimension: ReviewDimension = sourceId != null ? "SOURCE_METADATA" : "ITEM_FIDELITY";
  const events = await db.evidenceReviewEvent.findMany({
    where: { sourceId, itemId, dimension }, orderBy: { sequence: "asc" },
  });
  const revokedIds = new Set(events.filter(e => e.outcome === "REVOKED" && e.revokesEventId != null).map(e => e.revokesEventId!));
  const latest = [...events].reverse().find(e => e.outcome !== "REVOKED" && !revokedIds.has(e.id)) ?? null;
  const expired = latest?.validUntil != null && latest.validUntil.getTime() <= at.getTime();
  const unresolvedConflict = events.some(e => e.outcome === "CONFLICT" && !revokedIds.has(e.id));
  return {
    latest, expired, unresolvedConflict,
    usableAsTrustedEvidence: false as const,
    provenanceConfirmed: false as const,
    independentHistoricalSources: 0 as const,
    // Never derive current trust from metadata events in Phase 3B-1.
  };
}
