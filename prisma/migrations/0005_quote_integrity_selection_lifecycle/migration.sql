-- P2-1F: fail closed rather than silently choosing a duplicate business record.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Quote" GROUP BY "rfqId", "supplierId" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'P2-1F blocked: duplicate Quote(rfqId,supplierId) rows exist; resolve manually before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "QuoteItem" GROUP BY "quoteId", "rfqItemId" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'P2-1F blocked: duplicate QuoteItem(quoteId,rfqItemId) rows exist; resolve manually before migration';
  END IF;
END $$;

ALTER TABLE "Quote" ADD CONSTRAINT "Quote_rfqId_supplierId_key" UNIQUE ("rfqId", "supplierId");
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_rfqItemId_key" UNIQUE ("quoteId", "rfqItemId");
