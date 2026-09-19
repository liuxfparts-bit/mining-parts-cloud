-- ============================================================
-- V3.6 Stage 3.6B-P0: Part Number Cross Reference
-- Additive only. No existing tables modified. No data backfill.
-- ============================================================

-- CreateEnum
CREATE TYPE "PartNumberCrossReferenceType" AS ENUM ('SAME_PART', 'CROSS_REFERENCE', 'POSSIBLE_MATCH', 'SUPERSEDES');

-- CreateEnum
CREATE TYPE "CrossReferenceVerificationStatus" AS ENUM ('CANDIDATE', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "PartNumberCrossReference" (
    "id" SERIAL NOT NULL,
    "sourcePartNumberId" INTEGER NOT NULL,
    "targetPartNumberId" INTEGER NOT NULL,
    "relationType" "PartNumberCrossReferenceType" NOT NULL,
    "verificationStatus" "CrossReferenceVerificationStatus" NOT NULL DEFAULT 'CANDIDATE',
    "confidence" "DataConfidence" NOT NULL DEFAULT 'MEDIUM',
    "evidenceSummary" TEXT,
    "sourceReference" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartNumberCrossReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unique: prevent duplicate relation for same pair + type)
CREATE UNIQUE INDEX "PartNumberCrossReference_sourcePartNumberId_targetPartNumberId_relationType_key" ON "PartNumberCrossReference"("sourcePartNumberId", "targetPartNumberId", "relationType");

-- CreateIndex
CREATE INDEX "PartNumberCrossReference_sourcePartNumberId_idx" ON "PartNumberCrossReference"("sourcePartNumberId");

-- CreateIndex
CREATE INDEX "PartNumberCrossReference_targetPartNumberId_idx" ON "PartNumberCrossReference"("targetPartNumberId");

-- CreateIndex
CREATE INDEX "PartNumberCrossReference_relationType_idx" ON "PartNumberCrossReference"("relationType");

-- CreateIndex
CREATE INDEX "PartNumberCrossReference_verificationStatus_idx" ON "PartNumberCrossReference"("verificationStatus");

-- AddForeignKey (source → PartNumber, cascade delete)
ALTER TABLE "PartNumberCrossReference" ADD CONSTRAINT "PartNumberCrossReference_sourcePartNumberId_fkey" FOREIGN KEY ("sourcePartNumberId") REFERENCES "PartNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (target → PartNumber, cascade delete)
ALTER TABLE "PartNumberCrossReference" ADD CONSTRAINT "PartNumberCrossReference_targetPartNumberId_fkey" FOREIGN KEY ("targetPartNumberId") REFERENCES "PartNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (verifiedBy → User, set null on delete: 验证人删除后保留关系记录，verifiedById 置 NULL)
ALTER TABLE "PartNumberCrossReference" ADD CONSTRAINT "PartNumberCrossReference_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integrity CHECK 1: prevent self-reference (A → A)
ALTER TABLE "PartNumberCrossReference" ADD CONSTRAINT "PartNumberCrossReference_no_self_reference" CHECK ("sourcePartNumberId" <> "targetPartNumberId");

-- Integrity CHECK 2: canonical ordering for symmetric relation types
--   SAME_PART / CROSS_REFERENCE / POSSIBLE_MATCH: sourcePartNumberId < targetPartNumberId (min id as source)
--   SUPERSEDES (directional): no ordering constraint (source = 替代者, target = 被替代者)
ALTER TABLE "PartNumberCrossReference" ADD CONSTRAINT "PartNumberCrossReference_canonical_ordering" CHECK (
    ("relationType" IN ('SAME_PART', 'CROSS_REFERENCE', 'POSSIBLE_MATCH') AND "sourcePartNumberId" < "targetPartNumberId")
    OR ("relationType" = 'SUPERSEDES')
);
