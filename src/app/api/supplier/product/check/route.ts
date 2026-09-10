import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const s = await auth();
  if (!s) return NextResponse.json({ exists: false }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  if (!user?.supplierId) return NextResponse.json({ exists: false });
  const url = new URL(req.url);
  const partNumberId = parseInt(url.searchParams.get("partNumberId") || "0");
  const existing = await prisma.product.findFirst({ where: { supplierId: user.supplierId, partNumberId } });
  return NextResponse.json({ exists: !!existing });
}
