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
  const nameEn = (formData.get("nameEn") as string)?.trim() || null;
  let slug = (formData.get("slug") as string)?.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "";
  if (!slug) slug = (nameEn || name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (!slug) slug = "brand-" + Date.now();
  const exists = await prisma.brand.findUnique({ where: { slug } });
  if (exists) throw new Error("该品牌 URL 标识已存在，请修改");
  await prisma.brand.create({ data: { name, slug, nameEn } });
  revalidatePath("/admin/brands");
  revalidatePath("/");
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
  let slug = (formData.get("slug") as string)?.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "";
  if (!slug) slug = (nameEn || name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (!slug) slug = "brand-" + Date.now();
  const dup = await prisma.brand.findFirst({ where: { slug, NOT: { id } } });
  if (dup) throw new Error("该品牌 URL 标识已存在，请修改");
  await prisma.brand.update({ where: { id }, data: { name, nameEn, country, slug } });
  revalidatePath("/admin/brands");
  revalidatePath("/");
  redirect("/admin/brands");
}
export async function createEquipment(formData: FormData) {
  await requireAdmin();
  const v = (k: string) => (formData.get(k) as string)?.trim() || null;
  const model = (formData.get("model") as string).trim();
  const name = (formData.get("name") as string).trim();
  const brandId = parseInt(formData.get("brandId") as string);
  const inputSlug = (formData.get("slug") as string)?.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const slug = inputSlug || model.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  await prisma.equipment.create({
    data: {
      model, name, brandId,
      nameEn: v("nameEn"), series: v("series"),
      equipmentType: (formData.get("equipmentType") as string) || "通用",
      application: v("application"), mineType: v("mineType"), manufacturer: v("manufacturer"),
      description: v("description"), imageUrl: v("imageUrl"),
      slug: slug || "eq-" + Date.now(),
      status: "ACTIVE",
    },
  });
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
  const v = (k: string) => (formData.get(k) as string)?.trim() || null;
  await prisma.equipment.update({
    where: { id },
    data: {
      brandId: parseInt(formData.get("brandId") as string),
      model: (formData.get("model") as string).trim(),
      name: (formData.get("name") as string).trim(),
      nameEn: v("nameEn"),
      series: v("series"),
      equipmentType: (formData.get("equipmentType") as string) || "通用",
      application: v("application"),
      description: v("description"),
      imageUrl: v("imageUrl"),
      brochure: v("brochure"),
      status: (formData.get("status") as string) || "ACTIVE",
    },
  });
  revalidatePath("/admin/equipment");
  revalidatePath("/equipment");
  redirect("/admin/equipment");
}

export async function deleteEquipment(id: number) {
  await requireAdmin();
  const used = await prisma.partNumber.count({ where: { equipmentId: id } });
  if (used > 0) {
    await prisma.equipment.update({ where: { id }, data: { status: "OFFLINE" } });
  } else {
    await prisma.equipment.delete({ where: { id } });
  }
  revalidatePath("/admin/equipment");
}

export async function toggleEquipmentStatus(id: number) {
  await requireAdmin();
  const e = await prisma.equipment.findUnique({ where: { id } });
  if (!e) return;
  await prisma.equipment.update({ where: { id }, data: { status: e.status === "ACTIVE" ? "OFFLINE" : "ACTIVE" } });
  revalidatePath("/admin/equipment");
  revalidatePath("/");
  revalidatePath("/equipment");
  revalidatePath(`/equipment/${e.slug}`);
  revalidatePath(`/brands/${e.slug}`);
  revalidatePath("/sitemap.xml");
}

export async function quickCreateBrand(name: string, nameEn?: string) {
  await requireAdmin();
  const n = name.trim();
  const ne = nameEn?.trim() || null;
  if (!n) return { error: "品牌名必填" };
  const slug = (ne || n).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const exists = await prisma.brand.findFirst({ where: { OR: [{ name: n }, { slug }] } });
  if (exists) return { error: "该品牌已存在", id: exists.id };
  const b = await prisma.brand.create({ data: { name: n, nameEn: ne, slug: slug || "brand-" + Date.now() } });
  revalidatePath("/admin/equipment/new");
  return { id: b.id };
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

export async function toggleFeaturedProduct(id: number) {
  await requireAdmin();
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return;
  await prisma.product.update({ where: { id }, data: { isFeatured: !p.isFeatured } });
  revalidatePath("/admin/products");
  revalidatePath("/");
}
