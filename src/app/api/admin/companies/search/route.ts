import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const s = await auth();
  const u = await prisma.user.findUnique({ where: { email: (s?.user as any)?.email } });
  if (!u || u.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q") || "";
  const list = await prisma.supplier.findMany({
    where: { name: { contains: q, mode: "insensitive" as const } },
    take: 20,
  });
  return NextResponse.json(list.map((c) => ({ id: c.id, name: c.name, province: c.province, verifiedStatus: c.verifiedStatus })));
}
