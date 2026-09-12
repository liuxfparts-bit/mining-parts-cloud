"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { toSlug } from "@/lib/slug";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

export async function approvePartNumberRequest(id: number) {
  await requireAdmin();
  const req = await prisma.partNumberRequest.findUnique({ where: { id } });
  if (!req) throw new Error("申请不存在");
  if (req.status !== "PENDING") throw new Error("该申请已处理");

  // 找品牌
  let brandId: number | null = null;
  if (req.brandName) {
    const brand = await prisma.brand.findFirst({ where: { name: req.brandName } });
    if (brand) brandId = brand.id;
  }

  // 找设备
  let equipmentId: number | null = null;
  if (req.equipmentModel && brandId) {
    const eq = await prisma.equipment.findFirst({ where: { brandId, model: req.equipmentModel } });
    if (eq) equipmentId = eq.id;
  }

  // 生成唯一 slug
  let slug = toSlug(req.partNumber);
  if (!slug) slug = `pn-${req.id}`;
  const existing = await prisma.partNumber.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${req.id}`;

  await prisma.$transaction([
    prisma.partNumber.create({
      data: {
        number: req.partNumber,
        slug,
        name: req.partName,
        category: req.categoryId ? "" : "其他",
        categoryId: req.categoryId,
        brandId,
        equipmentId,
        description: req.description,
        images: req.images,
      },
    }),
    prisma.partNumberRequest.update({
      where: { id: req.id },
      data: { status: "APPROVED" },
    }),
  ]);

  revalidatePath("/admin/part-numbers/requests");
  revalidatePath("/part-number");
}

export async function rejectPartNumberRequest(id: number, reason: string) {
  await requireAdmin();
  if (!reason || !reason.trim()) throw new Error("请填写驳回原因");
  await prisma.partNumberRequest.update({
    where: { id },
    data: { status: "REJECTED", reviewReason: reason.trim() },
  });
  revalidatePath("/admin/part-numbers/requests");
}
