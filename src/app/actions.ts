"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireVerifiedBuyer } from "@/lib/buyer-company";

export async function createRFQ(prevState: { error?: string; success?: boolean }, formData: FormData) {
  // 服务端身份校验：必须登录，归属写入当前登录用户（禁止前端传 buyerId/userId）
  const session = await auth();
  if (!session?.user) {
    return { error: "登录已失效，请重新登录后再发布询价" };
  }
  const sessionUser = await prisma.user.findUnique({
    where: { email: String((session.user as any).email).toLowerCase() },
    select: { id: true, role: true, buyerCompanyId: true },
  });
  if (!sessionUser) {
    return { error: "登录已失效，请重新登录后再发布询价" };
  }
  // 采购商企业认证门槛：BUYER 必须企业认证通过才可发布 RFQ（SUPPLIER/ADMIN 不拦截）
  const gate = await requireVerifiedBuyer(sessionUser.id);
  if (!gate.allowed) {
    return { error: gate.reason || "企业认证未通过，无法发布询价" };
  }

  const title = String(formData.get("title") || "");
  const deliveryDateStr = String(formData.get("deliveryDate") || "");
  const deliveryLocation = String(formData.get("deliveryLocation") || "");
  const incoterm = String(formData.get("incoterm") || "");
  const contactName = String(formData.get("contactName") || "");
  const contactPhone = String(formData.get("contactPhone") || "");
  const contactEmail = String(formData.get("contactEmail") || "");
  const whatsapp = String(formData.get("whatsapp") || "");
  const itemsRaw = String(formData.get("items") || "[]");
  let items: {
    brandName?: string;
    equipmentModel?: string;
    productName?: string;
    partNumber?: string;
    quantity?: string;
    unit?: string;
    description?: string;
    images?: string[];
  }[] = [];
  try {
    items = JSON.parse(itemsRaw);
    if (!Array.isArray(items)) items = [];
  } catch {
    items = [];
  }

  // 过滤无效明细：必须有配件名称或件号，且数量 > 0
  const validItems = items
    .map((it, idx) => ({ ...it, idx }))
    .filter(
      (it) =>
        (String(it.productName || "").trim() !== "" ||
          String(it.partNumber || "").trim() !== "" ||
          String(it.brandName || "").trim() !== "") &&
        (parseInt(String(it.quantity || "0")) || 0) > 0
    );

  if (!title || validItems.length === 0 || !contactName || !contactPhone) {
    return { error: "请填写询价标题、至少一条有效采购明细和联系人信息" };
  }

  try {
    // 逐条匹配件号 → 合并匹配到的供应商
    const matchedSupplierIds: number[] = [];
    const itemDatas: {
      seq: number;
      brandId: number | null;
      partNumberId: number | null;
      brandName: string | null;
      equipmentModel: string | null;
      productName: string | null;
      partNumberStr: string | null;
      quantity: number;
      unit: string;
      description: string | null;
      images: string | null;
    }[] = [];

    for (const it of validItems) {
      let partNumberId: number | null = null;
      const pn = String(it.partNumber || "").trim();
      if (pn) {
        const found = await prisma.partNumber.findUnique({
          where: { number: pn.toUpperCase() },
          include: { products: true },
        });
        if (found) {
          partNumberId = found.id;
          for (const p of found.products) matchedSupplierIds.push(p.supplierId);
        }
      }
      itemDatas.push({
        seq: validItems.indexOf(it) + 1,
        brandId: null,
        partNumberId,
        brandName: String(it.brandName || "").trim() || null,
        equipmentModel: String(it.equipmentModel || "").trim() || null,
        productName: String(it.productName || "").trim() || null,
        partNumberStr: pn || null,
        quantity: parseInt(String(it.quantity || "1")) || 1,
        unit: String(it.unit || "pcs"),
        description: String(it.description || "").trim() || null,
        images: Array.isArray(it.images) && it.images.length ? JSON.stringify(it.images) : null,
      });
    }

    const uniqueMatched = Array.from(new Set(matchedSupplierIds));
    const first = itemDatas[0];

    await prisma.$transaction(async (tx) => {
      // 生成 rfqNo：RFQ-YYYYMMDD-当天序号
      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayCount = await tx.rFQ.count({ where: { createdAt: { gte: dayStart } } });
      const rfqNo = `RFQ-${ymd}-${String(dayCount + 1).padStart(3, "0")}`;

      const rfq = await tx.rFQ.create({
        data: {
          title,
          // 归属字段：RFQ 必须绑定当前登录采购商（session 服务端身份）
          userID: sessionUser.id,
          // 企业归属：同企业主/子账号共享 RFQ（主子账号体系）
          companyID: sessionUser.buyerCompanyId || null,
          // 兼容字段：第一条明细同步写入 RFQ 旧字段，保证旧列表/后台照常显示
          brandName: first.brandName,
          equipmentModel: first.equipmentModel,
          productName: first.productName,
          partNumberStr: first.partNumberStr,
          partNumberId: first.partNumberId,
          quantity: first.quantity,
          unit: first.unit,
          description: first.description || "",
          images: first.images,
          rfqNo,
          deliveryDate: deliveryDateStr ? new Date(deliveryDateStr) : null,
          deliveryLocation: deliveryLocation || null,
          incoterm: incoterm || null,
          contactName,
          contactPhone,
          contactEmail: contactEmail || null,
          whatsapp: whatsapp || null,
          matchedSuppliers: uniqueMatched.length > 0 ? JSON.stringify(uniqueMatched) : null,
        },
      });

      for (const it of itemDatas) {
        await tx.rFQItem.create({
          data: { ...it, rfqId: rfq.id },
        });
      }
    });
  } catch (e) {
    console.error("createRFQ error:", e);
    return { error: "提交失败，请重试" };
  }

  revalidatePath("/rfq");
  revalidatePath("/rfqs");
  // 发布成功后按角色回到各自询价管理页（采购商 → 后台"我的询价"，不再跳到前台公共页）
  if (sessionUser.role === "ADMIN") redirect("/admin/rfqs");
  if (sessionUser.role === "SUPPLIER") redirect("/supplier/rfqs");
  redirect("/dashboard/rfqs");
}
