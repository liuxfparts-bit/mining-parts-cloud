-- Retire legacy PartNumber -> Equipment relation.
-- PartNumberEquipment is now the canonical many-to-many relation.

DROP INDEX IF EXISTS "PartNumber_equipmentId_idx";

ALTER TABLE "PartNumber" DROP CONSTRAINT IF EXISTS "PartNumber_equipmentId_fkey";

ALTER TABLE "PartNumber" DROP COLUMN "equipmentId";
