import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ items: [] });
  const items = await prisma.partNumber.findMany({
    where: { number: { contains: q, mode: "insensitive" } },
    include: { brand: true, equipment: true },
    take: 20,
  });
  return NextResponse.json({ items });
}
