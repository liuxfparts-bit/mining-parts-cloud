import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const s = await auth();
  if (!s) return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  if (!user?.supplierId) return NextResponse.json({ success: false, message: "无企业" }, { status: 400 });

  const b = await req.json();
  const partNumberId = parseInt(b.partNumberId);
  if (!partNumberId) return NextResponse.json({ success: false, message: "未选件号" }, { status: 400 });

  const dup = await prisma.product.findFirst({ where: { supplierId: user.supplierId, partNumberId } });
  if (dup) return NextResponse.json({ success: false, message: "您已为该件号发布产品" }, { status: 409 });

  await prisma.product.create({
    data: {
      name: b.name || "",
      partNumberId,
      supplierId: user.supplierId,
      productType: b.productType || "Aftermarket",
      price: b.price,
      currency: b.currency || "CNY",
      moq: b.moq || 1,
      stockStatus: b.stockStatus || "IN_STOCK",
      stock: b.stock,
      leadTime: b.leadTime,
      warranty: b.warranty,
      description: b.description,
      images: b.images || "",
      status: b.status === "DRAFT" ? "DRAFT" : "PENDING",
    },
  });
  return NextResponse.json({ success: true });
}
