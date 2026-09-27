"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canTransitionRfq } from "@/lib/rfq-lifecycle";

/** Company members may close active company RFQs, but may never delete another creator's RFQ. */
async function requireCompanyRfq(id: number) {
  const s = await auth();
  if (!s?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true },
  });
  if (!user) redirect("/login");
  const rfq = await prisma.rFQ.findUnique({ where: { id }, select: { id: true, userID: true, companyID: true, status: true } });
  if (!rfq || (rfq.userID !== user.id && !(rfq.companyID != null && rfq.companyID === (await prisma.user.findUnique({ where: { id: user.id }, select: { buyerCompanyId: true } }))?.buyerCompanyId))) throw new Error("无权操作该询价");
  return { user, rfq };
}

async function requireOwnedRfq(id: number) {
  const { user, rfq } = await requireCompanyRfq(id);
  if (rfq.userID !== user.id) throw new Error("仅询价创建者可删除该询价");
  return { user, rfq };
}

/** 采购商关闭自己的询价（COLLECTING / QUOTED → CLOSED） */
export async function closeMyRfq(id: number) {
  const { rfq } = await requireCompanyRfq(id);
  if (rfq.status === "CLOSED") return; // safe idempotent close
  if (!canTransitionRfq(rfq.status, "CLOSED")) throw new Error("该询价当前不能关闭");
  await prisma.rFQ.updateMany({ where: { id, status: rfq.status }, data: { status: "CLOSED" } });
  revalidatePath("/dashboard/rfqs");
  revalidatePath(`/dashboard/rfqs/${id}`);
  revalidatePath("/rfqs");
}

/** 采购商删除自己的询价：仅允许还没有供应商报价的询价（避免破坏 Quote 外键与历史报价数据） */
export async function deleteMyRfq(id: number) {
  const { rfq } = await requireOwnedRfq(id);
  if (rfq) {
    const quoteCount = await prisma.quote.count({ where: { rfqId: id } });
    if (quoteCount > 0) {
      throw new Error("该询价已有供应商报价，无法删除；您可以改为关闭询价");
    }
    // 级联删除 RFQ 及其 RFQItem（QuoteItem 随 Quote 不存在；RFQItem 由 RFQ onDelete: Cascade 清理）
    await prisma.rFQ.delete({ where: { id } });
  }
  revalidatePath("/dashboard/rfqs");
  revalidatePath("/rfqs");
}
