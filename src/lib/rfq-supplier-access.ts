/** IDs must be positive integers representable by Prisma's PostgreSQL Int. */
function isSupplierId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 2147483647;
}

/**
 * Server-side visibility policy. Call only after authentication, using the
 * supplier ID loaded from the user's database record, never request input.
 * Invitation tokens do not grant visibility. Unknown or corrupt data denies access.
 */
export function canSupplierAccessRfq(
  rfq: { visibility: unknown; matchedSuppliers: unknown },
  supplierId: unknown
): boolean {
  if (!isSupplierId(supplierId)) return false;
  if (rfq.visibility === "PUBLIC") return true;
  if (rfq.visibility !== "MATCHED_SUPPLIERS") return false;
  if (typeof rfq.matchedSuppliers !== "string") return false;

  let matched: unknown;
  try {
    matched = JSON.parse(rfq.matchedSuppliers);
  } catch {
    return false;
  }
  return Array.isArray(matched) && matched.every(isSupplierId) && matched.includes(supplierId);
}
