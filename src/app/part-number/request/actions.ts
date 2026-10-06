"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireSupplierWriteAccess } from "@/lib/supplier-write-access";

export async function submitPartNumberRequest(formData: FormData) {
  try {
    const access = await requireSupplierWriteAccess("BUSINESS");

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
        supplierId: access.supplierId,
        partNumber,
        partName,
        brandName,
        equipmentModel,
        categoryId,
        description,
      },
    });

    redirect("/supplier/requests?type=partNumber&submitted=true");
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[PartNumberRequest] ERROR", e);
    redirect("/part-number/request?error=" + encodeURIComponent("提交失败，请稍后重试"));
  }
}
