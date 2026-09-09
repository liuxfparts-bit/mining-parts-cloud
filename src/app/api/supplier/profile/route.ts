import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user?.supplierId) return NextResponse.json({ success: false, message: "无企业" }, { status: 400 });

  const body = await req.json();
  const cur = await prisma.supplier.findUnique({ where: { id: user.supplierId } });
  if (!cur) return NextResponse.json({ success: false, message: "企业不存在" }, { status: 404 });

  const v = (k: string) => body[k] || null;
  const data: any = {
    contactName: v("contactName"),
    mobile: v("mobile"),
    telephone: v("telephone"),
    email: v("email"),
    wechat: v("wechat"),
    whatsapp: v("whatsapp"),
    description: v("description"),
  };

  // VERIFIED 企业不允许改基础信息
  if (cur.verifiedStatus !== "VERIFIED") {
    data.name = v("name") || cur.name;
    data.province = v("province");
    data.city = v("city");
    data.address = v("address");
    data.mainBusiness = v("mainBusiness") || "";
    data.mainBrands = v("mainBrands");
    data.mainEquipment = v("mainEquipment");
  }

  await prisma.supplier.update({ where: { id: user.supplierId }, data });
  return NextResponse.json({ success: true, message: "保存成功，待管理员审核" });
}
