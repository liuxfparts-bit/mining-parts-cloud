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
  const adminIdRaw = (session.user as any).id;
  const adminId = Number.isNaN(Number(adminIdRaw)) ? null : Number(adminIdRaw);
  const sid = parseInt(id);
  await prisma.supplier.update({
    where: { id: sid },
    data: { verifiedStatus: "VERIFIED", approvedAt: new Date(), approvedBy: adminId },
  });
  // 审核通过后启用该企业关联的账号（注册时为 PENDING，避免无法登录且被前台过滤）
  await prisma.user.updateMany({
    where: { supplierId: sid },
    data: { status: "ACTIVE" },
  });
  revalidatePath("/admin/verification");
  revalidatePath("/admin/suppliers");
  revalidatePath("/");
  revalidatePath("/suppliers");
  revalidatePath("/search");
  revalidatePath("/sitemap.xml");
  redirect("/admin/verification");
}

// 驳回
export async function rejectCompany(id: string, reason: string) {
  const session = await requireAdmin();
  const adminIdRaw = (session.user as any).id;
  const adminId = Number.isNaN(Number(adminIdRaw)) ? null : Number(adminIdRaw);
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
  revalidatePath("/");
  revalidatePath("/suppliers");
  revalidatePath("/search");
  revalidatePath("/sitemap.xml");
  redirect("/admin/verification");
}

// 切换禁用（沿用 verifiedStatus 标记 DISABLED，前台查询已排除）
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
  revalidatePath("/");
  revalidatePath("/suppliers");
  revalidatePath("/search");
  revalidatePath("/sitemap.xml");
}

// ===== 兼容旧导出 =====
export async function reviewSupplier(id: number, status: "VERIFIED" | "REJECTED", reason?: string) {
  await requireAdmin();
  await prisma.supplier.update({ where: { id }, data: { verifiedStatus: status } });
  if (status === "VERIFIED") {
    await prisma.user.updateMany({
      where: { supplierId: id },
      data: { status: "ACTIVE" },
    });
  }
  revalidatePath("/admin/suppliers");
  revalidatePath("/");
  revalidatePath("/suppliers");
  revalidatePath("/search");
  revalidatePath("/sitemap.xml");
}
export async function updateMemberLevel(id: number, level: string) {
  await requireAdmin();
  await prisma.supplier.update({ where: { id }, data: { memberLevel: level } });
  revalidatePath(`/admin/suppliers/${id}`);
}

export async function reviewPartNumberStatus(id: number, formData: FormData) {
  const session = await requireAdmin();
  const requestedVerification = ((formData.get("verificationStatus") as string) || "").trim();
  const requestedPublish = ((formData.get("publishStatus") as string) || "HOLD").trim();
  const reason = ((formData.get("reason") as string) || "").trim();

  const allowedVerification = ["VERIFIED", "UNVERIFIED", "CONFLICT", "REJECTED"];
  if (!allowedVerification.includes(requestedVerification)) {
    throw new Error("无效的 Part Number 审核状态");
  }
  if (reason.length < 2 || reason.length > 2000) {
    throw new Error("审核备注/证据说明必填，长度需在 2-2000 字符之间");
  }

  const publishStatus = requestedVerification === "VERIFIED" && requestedPublish === "READY" ? "READY" : "HOLD";
  const adminIdRaw = (session.user as any).id;
  const adminId = Number.isNaN(Number(adminIdRaw)) ? null : Number(adminIdRaw);

  const current = await prisma.partNumber.findUnique({ where: { id } });
  if (!current) throw new Error("Part Number 不存在");

  const action =
    requestedVerification === "VERIFIED" ? "VERIFY" :
    requestedVerification === "CONFLICT" ? "MARK_CONFLICT" :
    requestedVerification === "REJECTED" ? "REJECT" :
    "REVERT_TO_UNVERIFIED";

  await prisma.$transaction(async (tx) => {
    await tx.partNumber.update({
      where: { id },
      data: {
        verificationStatus: requestedVerification as any,
        publishStatus: publishStatus as any,
        verified: requestedVerification === "VERIFIED" && publishStatus === "READY",
        lastVerifiedAt: requestedVerification === "VERIFIED" ? new Date() : null,
        verifiedById: requestedVerification === "VERIFIED" ? adminId : null,
      },
    });

    await tx.partNumberAuditLog.create({
      data: {
        partNumberId: id,
        action,
        oldVerification: current.verificationStatus,
        newVerification: requestedVerification,
        oldPublishStatus: current.publishStatus,
        newPublishStatus: publishStatus,
        reason,
        changedById: adminId,
      },
    });
  });

  revalidatePath("/admin/part-numbers");
  revalidatePath(`/admin/part-numbers/${id}`);
  redirect(`/admin/part-numbers/${id}`);
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
  try {
    const name = (formData.get("name") as string || "").trim();
    const nameEn = (formData.get("nameEn") as string || "").trim() || null;
    if (!name) throw new Error("品牌名称必填");
    let slug = (formData.get("slug") as string || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!slug) slug = (nameEn || name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!slug) slug = "brand-" + Date.now().toString();

    const nameDup = await prisma.brand.findUnique({ where: { name } });
    if (nameDup) throw new Error("该品牌名称已存在，请直接编辑已有品牌");
    const slugDup = await prisma.brand.findUnique({ where: { slug } });
    if (slugDup) throw new Error("该品牌 URL 标识已存在，请修改");

    await prisma.brand.create({ data: { name, slug, nameEn } });
    revalidatePath("/admin/brands");
    revalidatePath("/");
    redirect("/admin/brands");
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[createBrand] ERROR", e);
    redirect("/admin/brands?error=" + encodeURIComponent(e?.message || "新增品牌失败"));
  }
}
export async function deleteBrand(id: number) {
  await requireAdmin();
  await prisma.brand.delete({ where: { id } });
  revalidatePath("/admin/brands");
}

export async function updateBrand(id: number, formData: FormData) {
  await requireAdmin();
  try {
    const name = (formData.get("name") as string || "").trim();
    const nameEn = (formData.get("nameEn") as string || "").trim() || null;
    const country = (formData.get("country") as string || "").trim() || null;
    if (!name) throw new Error("品牌名称必填");
    let slug = (formData.get("slug") as string || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!slug) slug = (nameEn || name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!slug) slug = "brand-" + Date.now().toString();

    const dup = await prisma.brand.findFirst({ where: { OR: [{ slug, NOT: { id } }, { name, NOT: { id } }] } });
    if (dup) throw new Error("品牌名称或 URL 标识已被其他品牌占用");

    await prisma.brand.update({ where: { id }, data: { name, nameEn, country, slug } });
    revalidatePath("/admin/brands");
    revalidatePath("/");
    redirect("/admin/brands");
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[updateBrand] ERROR", e);
    redirect(`/admin/brands?error=` + encodeURIComponent(e?.message || "保存失败"));
  }
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
  const equipmentId = parseInt(formData.get("equipmentId") as string) || null;

  await prisma.$transaction(async (tx) => {
    const partNumber = await tx.partNumber.create({
      data: { number, name, slug: number.toLowerCase(), brandId, category: "其他" },
    });

    if (equipmentId) {
      await tx.partNumberEquipment.create({
        data: { partNumberId: partNumber.id, equipmentModelId: equipmentId },
      });
    }
  });

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
  const relationUsed = await prisma.partNumberEquipment.count({ where: { equipmentModelId: id } });
  if (relationUsed > 0) {
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
  try {
    const n = (name || "").trim();
    const ne = nameEn?.trim() || null;
    if (!n) return { error: "品牌名必填" };
    const slug = (ne || n).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const exists = await prisma.brand.findFirst({ where: { OR: [{ name: n }, { slug }] } });
    if (exists) return { error: "该品牌已存在", id: exists.id };
    const b = await prisma.brand.create({ data: { name: n, nameEn: ne, slug: slug || "brand-" + Date.now().toString() } });
    revalidatePath("/admin/equipment/new");
    return { id: b.id };
  } catch (e: any) {
    console.error("[quickCreateBrand] ERROR", e);
    if (e?.code === "P2002") return { error: "品牌名称或代号已存在" };
    return { error: "创建失败：" + (e?.message || "未知错误") };
  }
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

export async function toggleFeaturedProduct(id: number) {
  await requireAdmin();
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return;
  await prisma.product.update({ where: { id }, data: { isFeatured: !p.isFeatured } });
  revalidatePath("/admin/products");
  revalidatePath("/");
}

// ========== V3.6 Cross Reference 审核动作（VERIFY / REJECT） ==========
// 状态机：只有 CANDIDATE 允许 -> VERIFIED 或 -> REJECTED
// VERIFIED / REJECTED 为终态，第一版不实现撤销
// 并发安全：updateMany with where verificationStatus=CANDIDATE，根据 count 判断
// NO AUTO-ELEVATION：只更新 PartNumberCrossReference，不更新 PartNumber/Equipment/Product 等

export async function verifyCrossReference(id: number) {
  const session = await requireAdmin();
  const adminIdRaw = (session.user as any).id;
  const adminId = Number.isNaN(Number(adminIdRaw)) ? null : Number(adminIdRaw);

  // 并发安全：只有 CANDIDATE 状态才能转换为 VERIFIED
  const result = await prisma.partNumberCrossReference.updateMany({
    where: { id, verificationStatus: "CANDIDATE" },
    data: {
      verificationStatus: "VERIFIED",
      verifiedAt: new Date(),
      verifiedById: adminId,
      rejectionReason: null,
      rejectedAt: null,
    },
  });

  if (result.count === 0) {
    // 没有行被更新：区分 NOT_FOUND / ALREADY_VERIFIED / INVALID_STATE_TRANSITION
    const current = await prisma.partNumberCrossReference.findUnique({ where: { id } });
    if (!current) throw new Error("Cross Reference 不存在");
    if (current.verificationStatus === "VERIFIED") {
      // NO-OP：已经是 VERIFIED，静默成功（不重复更新时间/审核人）
    } else {
      throw new Error("INVALID_STATE_TRANSITION: 只有 CANDIDATE 状态才能验证，当前状态为 " + current.verificationStatus);
    }
  }

  revalidatePath("/admin/part-numbers/cross-references");
  revalidatePath(`/admin/part-numbers/cross-references/${id}`);
  redirect(`/admin/part-numbers/cross-references/${id}`);
}

export async function rejectCrossReference(id: number, formData: FormData) {
  await requireAdmin();

  // 驳回原因必填，trim 后 2-2000 字符
  const reason = (formData.get("rejectionReason") as string)?.trim() || "";
  if (reason.length < 2 || reason.length > 2000) {
    throw new Error("驳回原因必填，长度需在 2-2000 字符之间");
  }

  // 并发安全：只有 CANDIDATE 状态才能转换为 REJECTED
  const result = await prisma.partNumberCrossReference.updateMany({
    where: { id, verificationStatus: "CANDIDATE" },
    data: {
      verificationStatus: "REJECTED",
      rejectionReason: reason,
      rejectedAt: new Date(),
      verifiedAt: null,
      verifiedById: null,
    },
  });

  if (result.count === 0) {
    const current = await prisma.partNumberCrossReference.findUnique({ where: { id } });
    if (!current) throw new Error("Cross Reference 不存在");
    if (current.verificationStatus === "REJECTED") {
      // NO-OP：已经是 REJECTED，静默成功（不覆盖原 rejectionReason / rejectedAt）
    } else {
      throw new Error("INVALID_STATE_TRANSITION: 只有 CANDIDATE 状态才能驳回，当前状态为 " + current.verificationStatus);
    }
  }

  revalidatePath("/admin/part-numbers/cross-references");
  revalidatePath(`/admin/part-numbers/cross-references/${id}`);
  redirect(`/admin/part-numbers/cross-references/${id}`);
}
