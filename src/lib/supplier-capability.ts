import { prisma } from "@/lib/prisma";
import { normalizePartNumber, PUBLIC_PN_WHERE } from "@/lib/part-number";

export type TrustedSupplierCapabilityResult = {
  partNumberId: number | null;
  supplierIds: number[];
};

/**
 * Resolve a Part Number with the same normalization semantics established in P2-1B,
 * then return only suppliers backed by fully trusted capability evidence.
 *
 * Trusted capability requires all three layers:
 * 1) PartNumber = VERIFIED + READY
 * 2) Product = VERIFIED
 * 3) Supplier = VERIFIED
 *
 * No Product means no capability evidence. Brand/equipment similarity and supplierCount
 * are intentionally not used as inference signals.
 *
 * Matching fails closed when normalized matching is ambiguous: an exact number match is
 * preferred, otherwise exactly one normalized Part Number must exist.
 */
export async function findTrustedSupplierIdsForPartNumber(
  input: string | null | undefined
): Promise<TrustedSupplierCapabilityResult> {
  const raw = String(input || "").trim();
  if (!raw) return { partNumberId: null, supplierIds: [] };

  const normalized = normalizePartNumber(raw);
  const upper = raw.toUpperCase();

  const candidates = await prisma.partNumber.findMany({
    where: {
      ...PUBLIC_PN_WHERE,
      OR: [
        { number: { equals: upper, mode: "insensitive" } },
        ...(normalized
          ? [{ normalizedPartNumber: { equals: normalized, mode: "insensitive" as const } }]
          : []),
      ],
    },
    select: {
      id: true,
      number: true,
      normalizedPartNumber: true,
      products: {
        where: {
          verificationStatus: "VERIFIED",
          supplier: { verifiedStatus: "VERIFIED" },
        },
        select: { supplierId: true },
      },
    },
  });

  if (candidates.length === 0) {
    return { partNumberId: null, supplierIds: [] };
  }

  const exactMatches = candidates.filter(
    (candidate) => candidate.number.toUpperCase() === upper
  );

  let match: (typeof candidates)[number] | null = null;

  if (exactMatches.length === 1) {
    match = exactMatches[0];
  } else if (exactMatches.length > 1) {
    return { partNumberId: null, supplierIds: [] };
  } else if (normalized) {
    const normalizedMatches = candidates.filter(
      (candidate) => candidate.normalizedPartNumber?.toUpperCase() === normalized.toUpperCase()
    );

    if (normalizedMatches.length !== 1) {
      return { partNumberId: null, supplierIds: [] };
    }

    match = normalizedMatches[0];
  }

  if (!match) {
    return { partNumberId: null, supplierIds: [] };
  }

  return {
    partNumberId: match.id,
    supplierIds: Array.from(new Set(match.products.map((product) => product.supplierId))),
  };
}
