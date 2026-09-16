"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** Admin 服务端身份（仅管理员可审核） */
async function requireAdmin() {
  const session = await auth();
  const email = (session?.user as any)?.email;
  if (!email) redirect("/login");
  const admin = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase() },
    select: { id: true, role: true },
  });
  if (!admin || admin.role !== "ADMIN") redirect("/admin");
  return admin;
}

/** 审核通过：设定企业等级 + VERIFIED + 确认主账号 + 站内信通知全体成员 */
export async function approveBuyerCompany(formData: FormData) {
  const admin = await requireAdmin();
  const id = parseInt(String(formData.get("id") || ""));
  const level = String(formData.get("level") || "NORMAL");
  if (isNaN(id)) throw new Error("参数错误");

  const company = await prisma.buyerCompany.findUnique({
    where: { id },
    include: { users: { select: { id: true } } },
  });
  if (!company) throw new Error("企业不存在");

  await prisma.$transaction(async (tx) => {
    await tx.buyerCompany.update({
      where: { id },
      data: {
        verifiedStatus: "VERIFIED",
        level,
        rejectionReason: null,
        verifiedAt: new Date(),
        verifiedBy: admin.id,
      },
    });
    // 通知全体企业成员
    for (const u of company.users) {
      await tx.notification.create({
        data: {
          userId: u.id,
          type: "BUYER_VERIFY",
          title: "企业认证审核通过",
          content: `${company.companyName} 已通过平台认证，企业等级：${level === "GOLD" ? "金牌" : level === "SILVER" ? "银牌" : level === "BRONZE" ? "铜牌" : "普通"}会员。现在可以发布询价并邀请供应商报价。`,
          link: "/dashboard/company",
        },
      });
    }
  });

  revalidatePath("/admin/buyer-companies");
  revalidatePath("/admin/buyer-companies/" + id);
  redirect("/admin/buyer-companies");
}

/** 审核驳回：记录原因 + 站内信通知 */
export async function rejectBuyerCompany(formData: FormData) {
  const admin = await requireAdmin();
  const id = parseInt(String(formData.get("id") || ""));
  const reason = String(formData.get("reason") || "").trim();
  if (isNaN(id)) throw new Error("参数错误");
  if (!reason) throw new Error("请填写驳回原因");

  const company = await prisma.buyerCompany.findUnique({
    where: { id },
    include: { users: { select: { id: true } } },
  });
  if (!company) throw new Error("企业不存在");

  await prisma.$transaction(async (tx) => {
    await tx.buyerCompany.update({
      where: { id },
      data: { verifiedStatus: "REJECTED", rejectionReason: reason, verifiedBy: admin.id },
    });
    for (const u of company.users) {
      await tx.notification.create({
        data: {
          userId: u.id,
          type: "BUYER_VERIFY",
          title: "企业认证未通过",
          content: `${company.companyName} 的认证申请被驳回：${reason}。请修改后重新提交。`,
          link: "/dashboard/company",
        },
      });
    }
  });

  revalidatePath("/admin/buyer-companies");
  revalidatePath("/admin/buyer-companies/" + id);
  redirect("/admin/buyer-companies");
}
