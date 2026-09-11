import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost";
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.redirect(new URL("/", base));
    const b = await prisma.banner.findUnique({ where: { id } });
    if (!b) return NextResponse.redirect(new URL("/", base));
    const now = new Date();
    const valid = b.status === "ACTIVE" && (!b.startAt || b.startAt <= now) && (!b.endAt || b.endAt >= now);
    if (valid) {
      await prisma.banner.update({ where: { id }, data: { clicks: { increment: 1 } } }).catch(() => {});
    }
    let url = b.targetUrl || "/";
    if (b.targetType === "PRODUCT" && b.targetId) url = `/products/${b.targetId}`;
    if (b.targetType === "COMPANY" && b.targetId) url = `/suppliers/${b.targetId}`;
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/", base));
  }
}
