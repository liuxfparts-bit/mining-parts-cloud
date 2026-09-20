-- ============================================================
-- V3.1 Stage 3.6C-P1-A: PartNumberCrossReference Review Fields
-- Additive only. 仅增加驳回所需字段，不修改现有列，不 backfill，不删除。
-- 当前 CrossReference id=1 保持完全不变（新增列均为 NULL）。
-- ============================================================

-- AlterTable: 增加驳回原因（REJECTED 时必填，CANDIDATE/VERIFIED 时为 NULL）
ALTER TABLE "PartNumberCrossReference" ADD COLUMN "rejectionReason" TEXT;

-- AlterTable: 增加驳回时间
ALTER TABLE "PartNumberCrossReference" ADD COLUMN "rejectedAt" TIMESTAMP(3);
