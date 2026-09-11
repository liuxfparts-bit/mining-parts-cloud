import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const b = await prisma.banner.findUnique({ where: { id } });
  if (!b) return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost"));
  await prisma.banner.update({ where: { id }, data: { clicks: { increment: 1 } } });
  let url = b.targetUrl || "/";
  if (b.targetType === "PRODUCT" && b.targetId) url = `/products/${b.targetId}`;
  if (b.targetType === "COMPANY" && b.targetId) url = `/suppliers/${b.targetId}`;
  return NextResponse.redirect(url);
}
