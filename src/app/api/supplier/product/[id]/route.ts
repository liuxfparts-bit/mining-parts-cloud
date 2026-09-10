import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const s = await auth();
  if (!s) return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  if (!user?.supplierId) return NextResponse.json({ success: false, message: "无企业" }, { status: 400 });
  const product = await prisma.product.findUnique({ where: { id: parseInt(params.id) } });
  if (!product) return NextResponse.json({ success: false, message: "不存在" }, { status: 404 });
  if (product.supplierId !== user.supplierId) return NextResponse.json({ success: false, message: "无权" }, { status: 403 });

  const b = await req.json();
  const data: any = {
    name: b.name, productType: b.productType,
    price: b.price ? parseFloat(b.price) : null,
    currency: b.currency, moq: b.moq ? parseInt(b.moq) : 1,
    stockStatus: b.stockStatus, stock: b.stock ? parseInt(b.stock) : null,
    leadTime: b.leadTime, warranty: b.warranty,
    description: b.description, images: b.images || "",
  };
  if (b.action === "resubmit") {
    data.status = "PENDING";
    data.verificationStatus = "PENDING";
  }
  await prisma.product.update({ where: { id: product.id }, data });
  return NextResponse.json({ success: true });
}
