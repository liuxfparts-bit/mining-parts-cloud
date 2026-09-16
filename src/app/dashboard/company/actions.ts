"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function submitCompanyVerification(formData: FormData) {
  const session = await auth();
  const email = (session?.user as any)?.email;
  if (!email) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user || user.role !== "BUYER") redirect("/dashboard");

  const companyName = String(formData.get("companyName") || "").trim();
  const unifiedCode = String(formData.get("unifiedCode") || "").trim();
  const licenseImage = String(formData.get("licenseImage") || "").trim();
  const contactName = String(formData.get("contactName") || "").trim();
  const contactPhone = String(formData.get("contactPhone") || "").trim();
  const region = String(formData.get("region") || "").trim();
  const address = String(formData.get("address") || "").trim();

  if (!companyName) {
    redirect("/dashboard/company?error=" + encodeURIComponent("请填写企业名称"));
  }

  const existing = user.buyerCompanyId
    ? await prisma.buyerCompany.findUnique({ where: { id: user.buyerCompanyId } })
    : null;

  if (existing?.verifiedStatus === "VERIFIED") {
    // 已认证企业不允许直接修改，提示联系管理员
    redirect("/dashboard/company?error=" + encodeURIComponent("企业已认证，如需变更资质请联系平台管理员"));
  }

  if (existing) {
    await prisma.buyerCompany.update({
      where: { id: existing.id },
      data: {
        companyName,
        unifiedCode: unifiedCode || null,
        licenseImage: licenseImage || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        region: region || null,
        address: address || null,
        verifiedStatus: "PENDING",
        rejectionReason: null,
        submittedAt: new Date(),
      },
    });
  } else {
    const company = await prisma.buyerCompany.create({
      data: {
        companyName,
        unifiedCode: unifiedCode || null,
        licenseImage: licenseImage || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        region: region || null,
        address: address || null,
        verifiedStatus: "PENDING",
        submittedAt: new Date(),
        // 提交认证的账号即企业主账号（Admin 审核通过时正式确认 ownerUserId）
        ownerUserId: user.id,
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { buyerCompanyId: company.id, isOwner: true, company: companyName },
    });
  }

  revalidatePath("/dashboard/company");
  revalidatePath("/dashboard");
  redirect("/dashboard/company?submitted=1");
}
