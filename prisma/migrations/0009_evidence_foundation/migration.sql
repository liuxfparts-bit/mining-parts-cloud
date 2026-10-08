-- CreateEnum
CREATE TYPE "EvidenceCaptureState" AS ENUM ('PENDING_CAPTURE', 'CAPTURED_UNVERIFIED');

-- CreateEnum
CREATE TYPE "EvidenceReviewDimension" AS ENUM ('SOURCE_METADATA', 'ITEM_FIDELITY');

-- CreateEnum
CREATE TYPE "EvidenceReviewOutcome" AS ENUM ('CONFIRMED', 'REJECTED', 'REQUEST_MORE_EVIDENCE', 'CONFLICT', 'REVOKED');

-- CreateTable
CREATE TABLE "EvidenceSource" (
    "id" SERIAL NOT NULL,
    "stableKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "declaredKind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuerClaim" TEXT,
    "documentNumber" TEXT,
    "edition" TEXT,
    "acquisitionMethod" TEXT,
    "acquisitionNote" TEXT,
    "independenceGroupClaim" TEXT,
    "metadataFingerprint" CHAR(64) NOT NULL,
    "captureState" "EvidenceCaptureState" NOT NULL DEFAULT 'PENDING_CAPTURE',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" SERIAL NOT NULL,
    "stableKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "locatorKey" TEXT NOT NULL,
    "pageLabel" TEXT,
    "sectionLabel" TEXT,
    "itemLabel" TEXT,
    "rowLabel" TEXT,
    "excerpt" TEXT,
    "extractionMethod" TEXT,
    "captureState" "EvidenceCaptureState" NOT NULL DEFAULT 'PENDING_CAPTURE',
    "contentFingerprint" CHAR(64) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceReviewEvent" (
    "id" SERIAL NOT NULL,
    "sourceId" INTEGER,
    "itemId" INTEGER,
    "dimension" "EvidenceReviewDimension" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "previousEventId" INTEGER,
    "revokesEventId" INTEGER,
    "outcome" "EvidenceReviewOutcome" NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "targetFingerprint" CHAR(64) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "noExpiryReason" TEXT,
    "reviewerId" INTEGER NOT NULL,
    "reviewerSnapshot" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceSource_createdById_idx" ON "EvidenceSource"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceSource_stableKey_revision_key" ON "EvidenceSource"("stableKey", "revision");

-- CreateIndex
CREATE INDEX "EvidenceItem_sourceId_idx" ON "EvidenceItem"("sourceId");

-- CreateIndex
CREATE INDEX "EvidenceItem_createdById_idx" ON "EvidenceItem"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceItem_stableKey_revision_key" ON "EvidenceItem"("stableKey", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceItem_sourceId_locatorKey_revision_key" ON "EvidenceItem"("sourceId", "locatorKey", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceReviewEvent_previousEventId_key" ON "EvidenceReviewEvent"("previousEventId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceReviewEvent_idempotencyKey_key" ON "EvidenceReviewEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EvidenceReviewEvent_reviewerId_idx" ON "EvidenceReviewEvent"("reviewerId");

-- CreateIndex
CREATE INDEX "EvidenceReviewEvent_createdAt_idx" ON "EvidenceReviewEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceReviewEvent_sourceId_dimension_sequence_key" ON "EvidenceReviewEvent"("sourceId", "dimension", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceReviewEvent_itemId_dimension_sequence_key" ON "EvidenceReviewEvent"("itemId", "dimension", "sequence");

-- AddForeignKey
ALTER TABLE "EvidenceSource" ADD CONSTRAINT "EvidenceSource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EvidenceSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "EvidenceReviewEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EvidenceSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "EvidenceReviewEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EvidenceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "EvidenceReviewEvent_previousEventId_fkey" FOREIGN KEY ("previousEventId") REFERENCES "EvidenceReviewEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "EvidenceReviewEvent_revokesEventId_fkey" FOREIGN KEY ("revokesEventId") REFERENCES "EvidenceReviewEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "EvidenceReviewEvent_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Phase 3B-1 safeguards. No existing table is altered.
-- Phase 3B-1 cannot assert capture without immutable private snapshot (3B-2).
ALTER TABLE "EvidenceSource" ADD CONSTRAINT "evidence_source_pending_capture_only" CHECK ("captureState" = 'PENDING_CAPTURE');
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "evidence_item_pending_capture_only" CHECK ("captureState" = 'PENDING_CAPTURE');
ALTER TABLE "EvidenceSource" ADD CONSTRAINT "evidence_source_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "EvidenceSource" ADD CONSTRAINT "evidence_source_hash_hex" CHECK ("metadataFingerprint" ~ '^[0-9a-f]{64}$');
ALTER TABLE "EvidenceSource" ADD CONSTRAINT "evidence_source_key_nonempty" CHECK (length(btrim("stableKey")) > 0 AND length(btrim("title")) > 0);
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "evidence_item_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "evidence_item_hash_hex" CHECK ("contentFingerprint" ~ '^[0-9a-f]{64}$');
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "evidence_item_key_nonempty" CHECK (length(btrim("stableKey")) > 0 AND length(btrim("locatorKey")) > 0);
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "evidence_item_captured_has_excerpt" CHECK ("captureState" <> 'CAPTURED_UNVERIFIED' OR ("excerpt" IS NOT NULL AND length(btrim("excerpt")) > 0));
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "evidence_review_target_xor" CHECK (num_nonnulls("sourceId", "itemId") = 1);
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "evidence_review_dimension_target" CHECK (
  ("sourceId" IS NOT NULL AND "dimension" = 'SOURCE_METADATA') OR
  ("itemId" IS NOT NULL AND "dimension" = 'ITEM_FIDELITY')
);
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "evidence_review_sequence_positive" CHECK ("sequence" > 0);
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "evidence_review_hash_hex" CHECK ("targetFingerprint" ~ '^[0-9a-f]{64}$');
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "evidence_review_revocation_only" CHECK (
  ("outcome" = 'REVOKED' AND "revokesEventId" IS NOT NULL) OR
  ("outcome" <> 'REVOKED' AND "revokesEventId" IS NULL)
);
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "evidence_review_reason_nonempty" CHECK (
  length(btrim("reason")) > 0 AND length(btrim("verificationMethod")) > 0
  AND length(btrim("reviewerSnapshot")) > 0 AND length(btrim("idempotencyKey")) > 0
);
ALTER TABLE "EvidenceReviewEvent" ADD CONSTRAINT "evidence_review_expiry_explained" CHECK (
  ("validUntil" IS NULL AND "noExpiryReason" IS NOT NULL AND length(btrim("noExpiryReason")) > 0)
  OR ("validUntil" IS NOT NULL AND "noExpiryReason" IS NULL)
);

-- For append-only review history, only INSERT is permitted even to the application owner.
CREATE OR REPLACE FUNCTION evidence_foundation_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'evidence foundation is append-only; create a new version or review event'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER evidence_source_append_only
BEFORE UPDATE OR DELETE ON "EvidenceSource"
FOR EACH ROW EXECUTE FUNCTION evidence_foundation_reject_mutation();
CREATE TRIGGER evidence_item_append_only
BEFORE UPDATE OR DELETE ON "EvidenceItem"
FOR EACH ROW EXECUTE FUNCTION evidence_foundation_reject_mutation();
CREATE TRIGGER evidence_review_append_only
BEFORE UPDATE OR DELETE ON "EvidenceReviewEvent"
FOR EACH ROW EXECUTE FUNCTION evidence_foundation_reject_mutation();

-- Validate cross-row chains, target version, and revocation at INSERT time.
CREATE OR REPLACE FUNCTION evidence_review_validate_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  prior "EvidenceReviewEvent"%ROWTYPE;
  revoked "EvidenceReviewEvent"%ROWTYPE;
  target_hash TEXT;
  target_state TEXT;
BEGIN
  IF NEW."sourceId" IS NOT NULL THEN
    SELECT "metadataFingerprint", "captureState"::text INTO target_hash, target_state
    FROM "EvidenceSource" WHERE id = NEW."sourceId";
  ELSE
    SELECT "contentFingerprint", "captureState"::text INTO target_hash, target_state
    FROM "EvidenceItem" WHERE id = NEW."itemId";
  END IF;
  IF target_hash IS NULL OR target_hash <> NEW."targetFingerprint" THEN
    RAISE EXCEPTION 'review target fingerprint mismatch';
  END IF;
  IF NEW."outcome" = 'CONFIRMED' THEN
    RAISE EXCEPTION '3B-1 cannot confirm evidence without immutable source snapshot';
  END IF;
  IF NEW."sequence" = 1 THEN
    IF NEW."previousEventId" IS NOT NULL THEN
      RAISE EXCEPTION 'first review event cannot have predecessor';
    END IF;
  ELSE
    IF NEW."previousEventId" IS NULL THEN
      RAISE EXCEPTION 'review sequence requires predecessor';
    END IF;
    SELECT * INTO prior FROM "EvidenceReviewEvent" WHERE id = NEW."previousEventId";
    IF NOT FOUND OR prior."sequence" <> NEW."sequence" - 1
      OR prior."dimension" <> NEW."dimension"
      OR prior."sourceId" IS DISTINCT FROM NEW."sourceId"
      OR prior."itemId" IS DISTINCT FROM NEW."itemId" THEN
      RAISE EXCEPTION 'review predecessor must be same target and dimension';
    END IF;
  END IF;
  IF NEW."revokesEventId" IS NOT NULL THEN
    SELECT * INTO revoked FROM "EvidenceReviewEvent" WHERE id = NEW."revokesEventId";
    IF NOT FOUND OR revoked."dimension" <> NEW."dimension"
      OR revoked."sourceId" IS DISTINCT FROM NEW."sourceId"
      OR revoked."itemId" IS DISTINCT FROM NEW."itemId"
      OR revoked."sequence" >= NEW."sequence" THEN
      RAISE EXCEPTION 'revocation must target an earlier review on same target and dimension';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER evidence_review_insert_integrity
BEFORE INSERT ON "EvidenceReviewEvent"
FOR EACH ROW EXECUTE FUNCTION evidence_review_validate_insert();

-- A metadata review is never a SOURCE_AUTHENTICITY confirmation.
-- Provenance and independent-source facts remain unavailable until the private
-- immutable attachment and authenticity review slices are implemented.
