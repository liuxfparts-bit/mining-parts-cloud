import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSupplierWriteAccess } from "@/lib/supplier-write-access";

export async function POST(req: Request) {
  const access = await resolveSupplierWriteAccess("PROFILE");
  if (!access.ok) return NextResponse.json({ success: false, message: access.message, code: access.code }, { status: access.status });

  const body = await req.json();
  const cur = await prisma.supplier.findUnique({ where: { id: access.supplierId } });
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

  await prisma.supplier.update({ where: { id: access.supplierId }, data });
  return NextResponse.json({ success: true, message: "保存成功，待管理员审核" });
}
