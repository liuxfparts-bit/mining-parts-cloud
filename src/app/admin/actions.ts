"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

// 审核企业
export async function reviewSupplier(id: number, action: "APPROVED" | "REJECTED", reason?: string) {
  await requireAdmin();
  await prisma.supplier.update({
    where: { id },
    data: { verifiedStatus: action },
  });
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/verification");
}

// 修改会员等级
export async function updateMemberLevel(id: number, level: string) {
  await requireAdmin();
  await prisma.supplier.update({
    where: { id },
    data: { memberLevel: level },
  });
  revalidatePath(`/admin/suppliers/${id}`);
}

// 审核件号
export async function reviewPartNumber(id: number, verified: boolean) {
  await requireAdmin();
  await prisma.partNumber.update({
    where: { id },
    data: { verified },
  });
  revalidatePath("/admin/part-numbers");
}

// 产品上下架
export async function setProductStatus(id: number, status: string) {
  await requireAdmin();
  await prisma.product.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/products");
}

// RFQ 审核
export async function updateRfqStatus(id: number, status: string) {
  await requireAdmin();
  await prisma.rFQ.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/rfqs");
}

// 删除供应商
export async function deleteSupplier(id: number) {
  await requireAdmin();
  await prisma.supplier.delete({ where: { id } });
  revalidatePath("/admin/suppliers");
}

// 品牌 CRUD
export async function createBrand(formData: FormData) {
  await requireAdmin();
  const name = (formData.get("name") as string).trim();
  const nameEn = (formData.get("nameEn") as string)?.trim() || null;
  const country = (formData.get("country") as string)?.trim() || null;
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  await prisma.brand.create({ data: { name, nameEn, country, slug } });
  revalidatePath("/admin/brands");
}

export async function deleteBrand(id: number) {
  await requireAdmin();
  await prisma.brand.delete({ where: { id } });
  revalidatePath("/admin/brands");
}

// 设备 CRUD
export async function createEquipment(formData: FormData) {
  await requireAdmin();
  const model = (formData.get("model") as string).trim();
  const name = (formData.get("name") as string).trim();
  const brandId = parseInt(formData.get("brandId") as string);
  const equipmentType = (formData.get("equipmentType") as string).trim();
  await prisma.equipment.create({
    data: { model, name, brandId, equipmentType, slug: model.toLowerCase().replace(/\s+/g, "-") },
  });
  revalidatePath("/admin/equipment");
}

// 件号 CRUD
export async function createPartNumber(formData: FormData) {
  await requireAdmin();
  const number = (formData.get("number") as string).trim().toUpperCase();
  const name = (formData.get("name") as string).trim();
  const brandId = parseInt(formData.get("brandId") as string) || null;
  const equipmentId = parseInt(formData.get("equipmentId") as string) || null;
  await prisma.partNumber.create({
    data: { number, name, slug: number.toLowerCase(), brandId, equipmentId, category: "通用" },
  });
  revalidatePath("/admin/part-numbers");
}

// 产品 CRUD
export async function createProduct(formData: FormData) {
  await requireAdmin();
  const name = (formData.get("name") as string).trim();
  const partNumberId = parseInt(formData.get("partNumberId") as string);
  const supplierId = parseInt(formData.get("supplierId") as string);
  const price = parseFloat(formData.get("price") as string) || null;
  await prisma.product.create({
    data: { name, partNumberId, supplierId, price, status: "PENDING" },
  });
  revalidatePath("/admin/products");
}
