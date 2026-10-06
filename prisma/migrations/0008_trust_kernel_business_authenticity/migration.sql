-- Trust Kernel P0-2: separate real business facts from tests and unknown history.
-- Historical rows intentionally default to UNKNOWN. Do not bulk-label legacy data REAL.

CREATE TYPE "BusinessAuthenticity" AS ENUM ('UNKNOWN', 'REAL', 'TEST');

ALTER TABLE "RFQ"
  ADD COLUMN "businessAuthenticity" "BusinessAuthenticity" NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE "Quote"
  ADD COLUMN "businessAuthenticity" "BusinessAuthenticity" NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE "RFQInvitation"
  ADD COLUMN "businessAuthenticity" "BusinessAuthenticity" NOT NULL DEFAULT 'UNKNOWN';

CREATE INDEX "RFQ_businessAuthenticity_createdAt_idx"
  ON "RFQ"("businessAuthenticity", "createdAt");

CREATE INDEX "Quote_businessAuthenticity_createdAt_idx"
  ON "Quote"("businessAuthenticity", "createdAt");

CREATE INDEX "RFQInvitation_businessAuthenticity_createdAt_idx"
  ON "RFQInvitation"("businessAuthenticity", "createdAt");
