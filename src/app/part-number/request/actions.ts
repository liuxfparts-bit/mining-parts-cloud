"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function submitPartNumberRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/part-number/request");

  try {
    const userId = (session.user as any).id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { supplierId: true } });
    if (!user?.supplierId) redirect("/part-number/request?error=" + encodeURIComponent("请先完成企业入驻"));

    const partNumber = (formData.get("partNumber") as string || "").trim().toUpperCase();
    const partName = (formData.get("partName") as string || "").trim();
    const brandName = (formData.get("brandName") as string || "").trim();
    const equipmentModel = (formData.get("equipmentModel") as string || "").trim() || null;
    const categoryIdRaw = formData.get("categoryId");
    const categoryId = categoryIdRaw ? parseInt(categoryIdRaw as string) : null;
    const description = (formData.get("description") as string || "").trim() || null;

    if (!partNumber || !partName || !brandName) {
      redirect("/part-number/request?error=" + encodeURIComponent("件号、配件名称、品牌为必填"));
    }

    const existing = await prisma.partNumber.findUnique({ where: { number: partNumber } });
    if (existing) redirect("/part-number/request?error=" + encodeURIComponent(`件号 ${partNumber} 已存在，请直接发布产品`));

    const pending = await prisma.partNumberRequest.findFirst({
      where: { partNumber, status: "PENDING" },
    });
    if (pending) redirect("/part-number/request?error=" + encodeURIComponent("该件号已有待审核申请"));

    await prisma.partNumberRequest.create({
      data: {
        supplierId: user.supplierId,
        partNumber,
        partName,
        brandName,
        equipmentModel,
        categoryId,
        description,
      },
    });

    redirect("/part-number/request/success");
  } catch (e) {
    console.error("[PartNumberRequest] ERROR", e);
    redirect("/part-number/request?error=" + encodeURIComponent("提交失败，请稍后重试"));
  }
}
