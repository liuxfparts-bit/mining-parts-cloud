"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function submitPartNumberRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/part-number/request");

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { supplierId: true } });
  if (!user || !user.supplierId) throw new Error("请先完成企业入驻");

  const partNumber = (formData.get("partNumber") as string || "").trim().toUpperCase();
  const partName = (formData.get("partName") as string || "").trim();
  const brandName = (formData.get("brandName") as string || "").trim();
  const equipmentModel = (formData.get("equipmentModel") as string || "").trim() || null;
  const categoryIdRaw = formData.get("categoryId");
  const categoryId = categoryIdRaw ? parseInt(categoryIdRaw as string) : null;
  const description = (formData.get("description") as string || "").trim() || null;

  if (!partNumber || !partName || !brandName) throw new Error("件号、配件名称、品牌为必填");

  // 重复件号检查
  const existing = await prisma.partNumber.findUnique({ where: { number: partNumber } });
  if (existing) throw new Error(`件号 ${partNumber} 已存在，请直接发布产品`);

  // 重复申请检查
  const pending = await prisma.partNumberRequest.findFirst({
    where: { partNumber, status: "PENDING" },
  });
  if (pending) throw new Error("该件号已有待审核申请，请耐心等待");

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
}
