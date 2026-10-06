/** IDs must be positive integers representable by Prisma's PostgreSQL Int. */
function isDbId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 2147483647;
}

type RfqVisibility = {
  visibility: unknown;
  matchedSuppliers?: unknown;
  userID?: number | null;
  companyID?: number | null;
  businessAuthenticity?: unknown;
};

export type RfqAccessUser = {
  id: number;
  role: string;
  buyerCompanyId?: number | null;
  supplierId?: number | null;
};

/**
 * Supplier visibility policy. Use the supplier ID loaded from the authenticated
 * user's database record, never request input. Invitation tokens do not grant
 * visibility. Unknown/corrupt data fails closed.
 */
export function canSupplierAccessRfq(
  rfq: Pick<RfqVisibility, "visibility" | "matchedSuppliers">,
  supplierId: unknown
): boolean {
  if (!isDbId(supplierId)) return false;
  if (rfq.visibility === "PUBLIC") return true;
  if (rfq.visibility !== "MATCHED_SUPPLIERS") return false;
  if (typeof rfq.matchedSuppliers !== "string") return false;

  let matched: unknown;
  try {
    matched = JSON.parse(rfq.matchedSuppliers);
  } catch {
    return false;
  }
  return Array.isArray(matched) && matched.every(isDbId) && matched.includes(supplierId);
}

/** Buyer ownership is creator OR a member of the same buyer company. */
export function canBuyerAccessRfq(
  rfq: Pick<RfqVisibility, "userID" | "companyID">,
  user: Pick<RfqAccessUser, "id" | "buyerCompanyId">
): boolean {
  if (!isDbId(user.id)) return false;
  if (rfq.userID === user.id) return true;
  return isDbId(rfq.companyID) &&
    isDbId(user.buyerCompanyId) &&
    rfq.companyID === user.buyerCompanyId;
}

/**
 * Canonical read policy for RFQ detail surfaces.
 *
 * PUBLIC:
 *   anonymous + authenticated users may read.
 * MATCHED_SUPPLIERS:
 *   matched suppliers, owning buyer/company, and admin may read.
 * PRIVATE:
 *   owning buyer/company and admin may read; suppliers never gain access.
 * Unknown visibility fails closed except for admin/owner recovery access.
 */
export function canUserReadRfq(rfq: RfqVisibility, user: RfqAccessUser | null): boolean {
  // Admin and owning buyers retain recovery/audit access to TEST/UNKNOWN history.
  if (user?.role === "ADMIN") return true;
  if (user?.role === "BUYER" && canBuyerAccessRfq(rfq, user)) return true;

  // Anonymous/public truth is fail-closed: only explicitly REAL public RFQs.
  if (rfq.visibility === "PUBLIC" && rfq.businessAuthenticity === "REAL") return true;
  if (!user) return false;

  // Suppliers may still access explicitly authorized non-public/test flows.
  if (user.role === "SUPPLIER") return canSupplierAccessRfq(rfq, user.supplierId);
  return false;
}

/** Only REAL + PUBLIC RFQs belong on anonymous/public discovery surfaces. */
export function isPublicRfq(rfq: Pick<RfqVisibility, "visibility" | "businessAuthenticity">): boolean {
  return rfq.visibility === "PUBLIC" && rfq.businessAuthenticity === "REAL";
}
