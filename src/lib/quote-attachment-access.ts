import { canBuyerAccessRfq, type RfqAccessUser } from "@/lib/rfq-supplier-access";

/** Quote files are private even when their parent RFQ is publicly readable. */
export function canReadStoredQuoteAttachment(
  quote: { supplierId: number; rfq: { userID: number | null; companyID: number | null } },
  reader: RfqAccessUser | null
): boolean {
  if (!reader) return false;
  if (reader.role === "ADMIN") return true;
  if (reader.role === "SUPPLIER") return reader.supplierId != null && reader.supplierId === quote.supplierId;
  if (reader.role === "BUYER") return canBuyerAccessRfq(quote.rfq, reader);
  return false;
}
