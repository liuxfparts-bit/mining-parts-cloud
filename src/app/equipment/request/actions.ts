"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { toSlug } from "@/lib/slug";

export async function submitEquipmentRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/equipment/request");

  const userId = (session.user as any).id;
  // 找当前用户的 supplier
  const supplier = await prisma.supplier.findFirst({ where: { users: { some: { id: userId } } } });
  if (!supplier) throw new Error("请先完成企业入驻");

  const model = (formData.get("model") as string).trim();
  const brandId = formData.get("brandId") ? parseInt(formData.get("brandId") as string) : null;
  const brandNameInput = (formData.get("brandName") as string || "").trim();
  const brandName = brandId
    ? (await prisma.brand.findUnique({ where: { id: brandId } }))?.name || brandNameInput
    : brandNameInput;

  if (!brandName) throw new Error("请选择或填写品牌");
  if (!model) throw new Error("请填写设备型号");

  // 重复设备检查
  const existing = await prisma.equipment.findFirst({
    where: brandId ? { brandId, model } : { brand: { name: brandName }, model },
  });
  if (existing) throw new Error("该设备已存在，请直接查看：" + existing.model);

  // 重复申请检查
  const pending = await prisma.equipmentRequest.findFirst({
    where: { supplierId: supplier.id, model, status: "PENDING" },
  });
  if (pending) throw new Error("该型号已有待审核申请，请耐心等待");

  const v = (k: string) => (formData.get(k) as string || "").trim() || null;

  await prisma.equipmentRequest.create({
    data: {
      supplierId: supplier.id,
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
}
