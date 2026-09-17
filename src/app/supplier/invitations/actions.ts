"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { acceptInvitation, rejectInvitation, markInvitationViewed } from "@/lib/rfq-invitation";

/** 从 session 取当前供应商（服务端身份） */
async function requireSupplierUser() {
  const session = await auth();
  const email = (session?.user as any)?.email;
  if (!email) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, supplierId: true, role: true },
  });
  if (!user || user.role !== "SUPPLIER" || !user.supplierId) redirect("/supplier");
  return user;
}

/** 校验邀请归属当前供应商（防止 URL 篡改越权） */
async function requireOwnInvitation(invitationId: number, supplierId: number) {
  const inv = await prisma.rFQInvitation.findUnique({
    where: { id: invitationId },
    select: { id: true, rfqId: true, supplierId: true, token: true, status: true },
  });
  if (!inv || inv.supplierId !== supplierId) redirect("/supplier/invitations");
  return inv;
}

export async function acceptInvitationAction(formData: FormData) {
  const user = await requireSupplierUser();
  const invitationId = parseInt(String(formData.get("invitationId") || ""));
  if (isNaN(invitationId)) redirect("/supplier/invitations");

  const inv = await requireOwnInvitation(invitationId, user.supplierId!);
  // 已拒绝的邀请不可接受
  if (inv.status === "REJECTED") redirect("/supplier/invitations");

  await acceptInvitation(invitationId);
  revalidatePath("/supplier/invitations");
  // 直接带入 RFQ 信息跳转供应商后台报价页（保留统一后台布局，token 用于报价成功后回写邀请状态）
  redirect(`/supplier/rfqs/${inv.rfqId}?inv=${inv.token}`);
}

export async function rejectInvitationAction(formData: FormData) {
  const user = await requireSupplierUser();
  const invitationId = parseInt(String(formData.get("invitationId") || ""));
  const reason = String(formData.get("reason") || "").trim();
  if (isNaN(invitationId)) return { success: false, error: "参数错误" };
  if (!reason) return { success: false, error: "请选择暂不报价的原因" };

  await requireOwnInvitation(invitationId, user.supplierId!);
  await rejectInvitation(invitationId, reason);
  revalidatePath("/supplier/invitations");
  return { success: true, message: "已记录，感谢您的反馈" };
}

/** 供应商打开邀请详情/列表时调用（标记已查看）——由页面在渲染前标记，这里提供给操作按钮调用 */
export async function markInvitationViewedAction(formData: FormData) {
  const user = await requireSupplierUser();
  const invitationId = parseInt(String(formData.get("invitationId") || ""));
  if (isNaN(invitationId)) return;
  await requireOwnInvitation(invitationId, user.supplierId!);
  await markInvitationViewed(invitationId);
  revalidatePath("/supplier/invitations");
}
