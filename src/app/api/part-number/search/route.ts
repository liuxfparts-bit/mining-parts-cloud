import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePartNumber, PUBLIC_PN_WHERE } from "@/lib/part-number";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ items: [] });

  const normalized = normalizePartNumber(q);
  const items = await prisma.partNumber.findMany({
    where: {
      ...PUBLIC_PN_WHERE,
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        ...(normalized ? [{ normalizedPartNumber: { contains: normalized, mode: "insensitive" as const } }] : []),
      ],
    },
    include: { brand: true, equipmentRelations: { include: { equipmentModel: true } } },
    take: 20,
  });

  const upper = q.toUpperCase();
  items.sort((a, b) => {
    const score = (item: typeof a) => {
      if (item.number.toUpperCase() === upper) return 0;
      if (normalized && item.normalizedPartNumber === normalized) return 1;
      return 2;
    };
    return score(a) - score(b) || a.number.localeCompare(b.number);
  });

  return NextResponse.json({ items });
}
