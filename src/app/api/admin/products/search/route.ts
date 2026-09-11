import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const s = await auth();
  const u = await prisma.user.findUnique({ where: { email: (s?.user as any)?.email } });
  if (!u || u.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q") || "";
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { partNumber: { number: { contains: q, mode: "insensitive" as const } } },
      ],
    },
    include: { partNumber: { include: { brand: true, equipment: true } } },
    take: 20,
  });
  return NextResponse.json(products.map((p) => ({ id: p.id, name: p.name, partNumber: p.partNumber?.number, brand: p.partNumber?.brand?.name, equipment: p.partNumber?.equipment?.model })));
}
