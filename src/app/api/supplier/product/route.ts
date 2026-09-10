import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const s = await auth();
  if (!s) return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  if (!user?.supplierId) return NextResponse.json({ success: false, message: "无企业" }, { status: 400 });

  const b = await req.json();
  await prisma.product.create({
    data: {
      name: b.name,
      partNumberId: parseInt(b.partNumberId),      supplierId: user.supplierId,
      price: b.price ? parseFloat(b.price) : null,
      images: b.images || "",
      status: "PENDING",
    },
  });
  return NextResponse.json({ success: true });
}
