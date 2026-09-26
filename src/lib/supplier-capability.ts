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
    take: 10,
  });

  if (candidates.length === 0) {
    return { partNumberId: null, supplierIds: [] };
  }

  candidates.sort((a, b) => {
    const score = (item: typeof a) => {
      if (item.number.toUpperCase() === upper) return 0;
      if (normalized && item.normalizedPartNumber === normalized) return 1;
      return 2;
    };
    return score(a) - score(b) || a.number.localeCompare(b.number);
  });

  const match = candidates[0];
  return {
    partNumberId: match.id,
    supplierIds: Array.from(new Set(match.products.map((product) => product.supplierId))),
  };
}
