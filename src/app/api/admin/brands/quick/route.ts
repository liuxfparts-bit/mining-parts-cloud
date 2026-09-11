import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { name, nameEn, logo } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "品牌名必填" }, { status: 400 });
  const slug = (nameEn || name).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const exists = await prisma.brand.findFirst({ where: { OR: [{ name: name.trim() }, { slug }] } });
  if (exists) return NextResponse.json({ error: "该品牌已存在" }, { status: 400 });
  const b = await prisma.brand.create({ data: { name: name.trim(), nameEn: nameEn?.trim() || null, logo: logo || null, slug: slug || "brand-" + Date.now() } });
  return NextResponse.json({ brand: { id: b.id, name: b.name, nameEn: b.nameEn } });
}
