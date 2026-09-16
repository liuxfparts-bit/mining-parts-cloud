"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createInvitationsForRFQ, remindInvitation } from "@/lib/rfq-invitation";

/** 从 session 取当前采购商 User（服务端身份，绝不信任前端 buyerId） */
async function requireBuyerUser() {
  const session = await auth();
  const email = (session?.user as any)?.email;
  if (!email) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "BUYER") redirect("/dashboard");
  return user;
}

/** 校验 RFQ 归属当前采购商 */
async function requireOwnRfq(rfqId: number, userId: number) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
    select: { id: true, userID: true, title: true, status: true },
  });
  if (!rfq || rfq.userID !== userId) redirect("/dashboard/rfqs");
  return rfq;
}

export async function inviteSuppliersAction(formData: FormData) {
  const buyer = await requireBuyerUser();
  const rfqId = parseInt(String(formData.get("rfqId") || ""));
  if (isNaN(rfqId)) return { success: false, error: "参数错误" };

  const rfq = await requireOwnRfq(rfqId, buyer.id);

  // 解析供应商多选
  const supplierIds = formData
    .getAll("supplierIds")
    .map((v) => parseInt(String(v)))
    .filter((n) => !isNaN(n) && n > 0);

  // 外部供应商（可多条：索引前缀 company_/contact_/email_/phone_）
  const externals: { companyName?: string; contactName?: string; email?: string; phone?: string }[] = [];
  const idxs = new Set<number>();
  for (const key of Array.from(formData.keys())) {
    const m = /^(company|contact|email|phone)_(\d+)$/.exec(key);
    if (m) idxs.add(parseInt(m[2]));
  }
  for (const i of Array.from(idxs).sort()) {
    externals.push({
      companyName: String(formData.get(`company_${i}`) || ""),
      contactName: String(formData.get(`contact_${i}`) || ""),
      email: String(formData.get(`email_${i}`) || ""),
      phone: String(formData.get(`phone_${i}`) || ""),
    });
  }

  if (supplierIds.length === 0 && externals.length === 0) {
    return { success: false, error: "请至少选择一家供应商或填写外部供应商信息" };
  }

  const result = await createInvitationsForRFQ(rfqId, buyer.id, supplierIds, externals);
  if (result.error) return { success: false, error: result.error };

  return {
    success: true,
    created: result.created,
    reminded: result.reminded,
    message: `已发送 ${result.created} 个新邀请${result.reminded > 0 ? `，${result.reminded} 家为再次提醒` : ""}`,
    rfqTitle: rfq.title,
  };
}

export async function remindInvitationAction(formData: FormData) {
  const buyer = await requireBuyerUser();
  const invitationId = parseInt(String(formData.get("invitationId") || ""));
  if (isNaN(invitationId)) redirect("/dashboard/rfqs");

  const inv = await prisma.rFQInvitation.findUnique({
    where: { id: invitationId },
    select: { rfqId: true },
  });
  if (!inv) redirect("/dashboard/rfqs");
  const rfq = await requireOwnRfq(inv.rfqId, buyer.id);

  await remindInvitation(invitationId);
  revalidatePath(`/dashboard/rfqs/${rfq.id}`);
}
