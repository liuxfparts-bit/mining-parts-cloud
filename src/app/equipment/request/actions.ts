"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function submitEquipmentRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/equipment/request");

  try {
    const userId = parseInt((session.user as any).id);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { supplierId: true } });
    if (!user?.supplierId) redirect("/equipment/request?error=" + encodeURIComponent("请先完成企业入驻"));
    const supplierId = user.supplierId;

    const model = (formData.get("model") as string || "").trim();
    const brandIdRaw = formData.get("brandId");
    const brandId = brandIdRaw ? parseInt(brandIdRaw as string) : null;
    const brandNameInput = (formData.get("brandName") as string || "").trim();
    let brandName = brandNameInput;
    if (brandId) {
      const b = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!b) redirect("/equipment/request?error=" + encodeURIComponent("所选品牌不存在"));
      brandName = b.name;
    }

    if (!brandName) redirect("/equipment/request?error=" + encodeURIComponent("请选择或填写品牌"));
    if (!model) redirect("/equipment/request?error=" + encodeURIComponent("请填写设备型号"));

    const existing = await prisma.equipment.findFirst({
      where: brandId ? { brandId, model } : { brand: { name: brandName }, model },
    });
    if (existing) redirect("/equipment/request?error=" + encodeURIComponent(`该设备已存在：${existing.model}`));

    const pending = await prisma.equipmentRequest.findFirst({
      where: { supplierId, model, status: "PENDING" },
    });
    if (pending) redirect("/equipment/request?error=" + encodeURIComponent("该型号已有待审核申请"));

    const v = (k: string) => (formData.get(k) as string || "").trim() || null;

    await prisma.equipmentRequest.create({
      data: {
        supplierId,
        brandId,
        brandName,
        model,
        name: v("name") || model,
        nameEn: v("nameEn"),
        series: v("series"),
        equipmentType: v("equipmentType") || "其他",
        application: v("application"),
        mineType: v("mineType"),
        manufacturer: v("manufacturer"),
        description: v("description"),
        imageUrl: v("imageUrl"),
      },
    });

    redirect("/equipment/request/success");
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[EquipmentRequest] ERROR", e);
    redirect("/equipment/request?error=" + encodeURIComponent("提交失败，请稍后重试"));
  }
}
