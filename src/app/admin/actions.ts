"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}

// 编辑企业
export async function updateCompany(id: string, formData: FormData) {
  await requireAdmin();
  const sid = parseInt(id);
  const current = await prisma.supplier.findUnique({ where: { id: sid } });
  if (!current) throw new Error("企业不存在");

  const v = (k: string) => (formData.get(k) as string)?.trim() || null;
  const memberLevel = (formData.get("memberLevel") as string) || "FREE";

  if (current.verifiedStatus === "VERIFIED") {
    await prisma.supplier.update({ where: { id: sid }, data: { memberLevel } });
  } else {
    await prisma.supplier.update({
      where: { id: sid },
      data: {
        name: v("name") || current.name,
        nameEn: v("nameEn"),
        shortName: v("shortName"),
        contactName: v("contactName"),
        position: v("position"),
        mobile: v("mobile"),
        telephone: v("telephone"),
        email: v("email"),
        website: v("website"),
        wechat: v("wechat"),
        whatsapp: v("whatsapp"),
        province: v("province"),
        city: v("city"),
        address: v("address"),
        mainBusiness: v("mainBusiness") || "",
        mainBrands: v("mainBrands"),
        mainEquipment: v("mainEquipment"),
        description: v("description"),
        memberLevel,
        verifiedStatus: (formData.get("verifiedStatus") as string) || current.verifiedStatus,
      },
    });
  }
  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${sid}`);
  redirect("/admin/suppliers");
}

// 审核通过
export async function approveCompany(id: string) {
  const session = await requireAdmin();
  const adminId = (session.user as any).id;
  await prisma.supplier.update({
    where: { id: parseInt(id) },
    data: { verifiedStatus: "VERIFIED", approvedAt: new Date(), approvedBy: adminId },
  });
  revalidatePath("/admin/verification");
  revalidatePath("/admin/suppliers");
  redirect("/admin/verification");
}

// 驳回
export async function rejectCompany(id: string, reason: string) {
  const session = await requireAdmin();
  const adminId = (session.user as any).id;
  await prisma.supplier.update({
    where: { id: parseInt(id) },
    data: {
      verifiedStatus: "REJECTED",
      rejectionReason: reason,
      rejectedAt: new Date(),
      rejectedBy: adminId,
    },
  });
  revalidatePath("/admin/verification");
  revalidatePath("/admin/suppliers");
  redirect("/admin/verification");
}

// 切换禁用
export async function toggleDisableCompany(id: string) {
  await requireAdmin();
  const sid = parseInt(id);
  const cur = await prisma.supplier.findUnique({ where: { id: sid } });
  if (!cur) return;
  await prisma.supplier.update({
    where: { id: sid },
    data: { verifiedStatus: cur.verifiedStatus === "DISABLED" ? "PENDING" : "DISABLED" },
  });
  revalidatePath("/admin/suppliers");
}

// ===== 兼容旧导出 =====
export async function reviewSupplier(id: number, status: "VERIFIED" | "REJECTED", reason?: string) {
  await requireAdmin();
  await prisma.supplier.update({ where: { id }, data: { verifiedStatus: status } });
  revalidatePath("/admin/suppliers");
}
export async function updateMemberLevel(id: number, level: string) {
  await requireAdmin();
  await prisma.supplier.update({ where: { id }, data: { memberLevel: level } });
  revalidatePath(`/admin/suppliers/${id}`);
}
export async function reviewPartNumber(id: number, verified: boolean) {
  await requireAdmin();
  await prisma.partNumber.update({ where: { id }, data: { verified } });
  revalidatePath("/admin/part-numbers");
}
export async function setProductStatus(id: number, status: string) {
  await requireAdmin();
  await prisma.product.update({ where: { id }, data: { status } });
  revalidatePath("/admin/products");
}

export async function approveProduct(id: number) {
  const s = await requireAdmin();
  const admin = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  await prisma.product.update({
    where: { id },
    data: { status: "PUBLISHED", verificationStatus: "VERIFIED", verifiedAt: new Date(), verifiedBy: admin?.id ?? null },
  });
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function rejectProduct(id: number, reason: string) {
  const s = await requireAdmin();
  const admin = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  await prisma.product.update({
    where: { id },
    data: { status: "REJECTED", verificationStatus: "REJECTED", verificationReason: reason, rejectedAt: new Date(), rejectedBy: admin?.id ?? null },
  });
  revalidatePath("/admin/products");
  redirect("/admin/products");
}
export async function updateRfqStatus(id: number, status: string) {
  await requireAdmin();
  await prisma.rFQ.update({ where: { id }, data: { status } });
  revalidatePath("/admin/rfqs");
}
export async function createBrand(formData: FormData) {
  await requireAdmin();
  const name = (formData.get("name") as string).trim();
  await prisma.brand.create({ data: { name, slug: name.toLowerCase().replace(/\s+/g, "-") } });
  revalidatePath("/admin/brands");
}
export async function deleteBrand(id: number) {
  await requireAdmin();
  await prisma.brand.delete({ where: { id } });
  revalidatePath("/admin/brands");
}

export async function updateBrand(id: number, formData: FormData) {
  await requireAdmin();
  const name = (formData.get("name") as string).trim();
  const nameEn = (formData.get("nameEn") as string)?.trim() || null;
  const country = (formData.get("country") as string)?.trim() || null;
  await prisma.brand.update({ where: { id }, data: { name, nameEn, country } });
  revalidatePath("/admin/brands");
  redirect("/admin/brands");
}
export async function createEquipment(formData: FormData) {
  await requireAdmin();
  const model = (formData.get("model") as string).trim();
  const name = (formData.get("name") as string).trim();
  const brandId = parseInt(formData.get("brandId") as string);
  await prisma.equipment.create({ data: { model, name, brandId, equipmentType: "通用", slug: model.toLowerCase() } });
  revalidatePath("/admin/equipment");
}
export async function createPartNumber(formData: FormData) {
  await requireAdmin();
  const number = (formData.get("number") as string).trim().toUpperCase();
  const name = (formData.get("name") as string).trim();
  const brandId = parseInt(formData.get("brandId") as string) || null;
  await prisma.partNumber.create({ data: { number, name, slug: number.toLowerCase(), brandId, category: "其他" } });
  revalidatePath("/admin/part-numbers");
}

export async function updateEquipment(id: number, formData: FormData) {
  await requireAdmin();
  const model = (formData.get("model") as string).trim();
  const name = (formData.get("name") as string).trim();
  await prisma.equipment.update({
    where: { id },
    data: { model, name, equipmentType: (formData.get("equipmentType") as string) || "通用" },
  });
  revalidatePath("/admin/equipment");
  redirect("/admin/equipment");
}

export async function updatePartNumber(id: number, formData: FormData) {
  await requireAdmin();
  await prisma.partNumber.update({
    where: { id },
    data: {
      name: (formData.get("name") as string).trim(),
      specification: (formData.get("specification") as string) || null,
      application: (formData.get("application") as string) || null,
    },
  });
  revalidatePath("/admin/part-numbers");
  redirect("/admin/part-numbers");
}

export async function approvePartNumberRequest(formData: FormData) {
  await requireAdmin();
  const id = parseInt(formData.get("id") as string);
  const categoryId = formData.get("categoryId") ? parseInt(formData.get("categoryId") as string) : null;
  const req = await prisma.partNumberRequest.findUnique({ where: { id } });
  if (!req) redirect("/admin/part-number-requests");
  const existing = await prisma.partNumber.findUnique({ where: { number: req.partNumber } });
  if (!existing) {
    await prisma.partNumber.create({
      data: {
        number: req.partNumber,
        name: req.partName,
        slug: req.partNumber.toLowerCase(),
        category: "其他",
        categoryId: categoryId || req.categoryId,
      },
    });
  }
  await prisma.partNumberRequest.update({ where: { id }, data: { status: "APPROVED", categoryId: categoryId || req.categoryId } });
  revalidatePath("/admin/part-number-requests");
  redirect("/admin/part-number-requests");
}

export async function rejectPartNumberRequest(formData: FormData) {
  await requireAdmin();
  const id = parseInt(formData.get("id") as string);
  const reason = (formData.get("reason") as string) || "不符合要求";
  await prisma.partNumberRequest.update({ where: { id }, data: { status: "REJECTED", reviewReason: reason } });
  revalidatePath("/admin/part-number-requests");
  redirect("/admin/part-number-requests");
}
