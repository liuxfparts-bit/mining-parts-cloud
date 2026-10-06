"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAdminTransitionRfq } from "@/lib/rfq-lifecycle";
import { writeSecurityAudit } from "@/lib/security-audit";
import type { BusinessAuthenticity } from "@prisma/client";

async function requireAdmin() {
  const s = await auth();
  if (!s?.user) redirect("/login");
  if ((s.user as any).role !== "ADMIN") throw new Error("forbidden");
  return s;
}

export async function setRfqStatus(id: number, status: string) {
  await requireAdmin();
  const rfq = await prisma.rFQ.findUnique({ where: { id }, select: { status: true } });
  if (!rfq || !canAdminTransitionRfq(rfq.status, status)) throw new Error("非法询价状态转换");
  await prisma.rFQ.updateMany({ where: { id, status: rfq.status }, data: { status } });
  revalidatePath("/admin/rfqs");
}

export async function deleteRfqs(ids: number[]) {
  await requireAdmin();
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
  await prisma.$transaction(async (tx) => {
    const quoted = await tx.quote.findFirst({ where: { rfqId: { in: uniqueIds } }, select: { rfqId: true } });
    if (quoted) throw new Error("含有供应商报价的询价不能删除");
    await tx.rFQ.deleteMany({ where: { id: { in: uniqueIds } } });
  });
  revalidatePath("/admin/rfqs");
}

/** Atomic batch close: preflight every RFQ before writing any status. */
export async function closeRfqs(ids: number[]) {
  await requireAdmin();
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueIds.length === 0) throw new Error("未选择有效询价");
  await prisma.$transaction(async (tx) => {
    const rfqs = await tx.rFQ.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, status: true } });
    if (rfqs.length !== uniqueIds.length || rfqs.some((rfq) => !canAdminTransitionRfq(rfq.status, "CLOSED"))) {
      throw new Error("所选询价包含不能关闭的状态");
    }
    const updated = await tx.rFQ.updateMany({ where: { id: { in: uniqueIds }, status: { in: ["COLLECTING", "QUOTED", "SELECTED"] } }, data: { status: "CLOSED" } });
    if (updated.count !== uniqueIds.length) throw new Error("询价状态已变化，请刷新后重试");
  });
  revalidatePath("/admin/rfqs");
}


const BUSINESS_AUTHENTICITY = new Set<BusinessAuthenticity>(["UNKNOWN", "REAL", "TEST"]);

function assertBusinessAuthenticity(value: string): asserts value is BusinessAuthenticity {
  if (!BUSINESS_AUTHENTICITY.has(value as BusinessAuthenticity)) {
    throw new Error("非法业务真实性状态");
  }
}

/**
 * Classify the RFQ fact only. Quote and Invitation are independent business
 * events: they inherit the RFQ classification when created, but later RFQ
 * reclassification must never overwrite their own audit truth.
 */
export async function setRfqBusinessAuthenticity(id: number, value: string) {
  const session = await requireAdmin();
  assertBusinessAuthenticity(value);
  const actorUserId = Number((session.user as any).id) || null;

  const before = await prisma.rFQ.findUnique({
    where: { id },
    select: {
      businessAuthenticity: true,
      quotes: { where: { status: "ACCEPTED" }, select: { id: true, businessAuthenticity: true } },
    },
  });
  if (!before) throw new Error("询价不存在");
  if (before.quotes.some((q) => q.businessAuthenticity !== value)) {
    throw new Error("已接受报价必须与所属 RFQ 保持相同业务真实性；请先核对已接受报价");
  }

  await prisma.rFQ.update({ where: { id }, data: { businessAuthenticity: value } });

  await writeSecurityAudit({
    actorUserId,
    action: "RFQ_BUSINESS_AUTHENTICITY_CHANGED",
    targetType: "RFQ",
    targetId: id,
    summary: `RFQ business authenticity: ${before.businessAuthenticity} → ${value}`,
    metadata: { from: before.businessAuthenticity, to: value, cascade: false },
  });

  revalidatePath("/admin/rfqs");
  revalidatePath(`/admin/rfqs/${id}`);
  revalidatePath("/admin/analytics");
}

/**
 * Quote-level override for the exceptional case where a real RFQ contains a
 * deliberate test quote. This never changes the parent RFQ classification.
 */
export async function setQuoteBusinessAuthenticity(id: number, value: string) {
  const session = await requireAdmin();
  assertBusinessAuthenticity(value);
  const actorUserId = Number((session.user as any).id) || null;

  const quote = await prisma.quote.findUnique({
    where: { id },
    select: {
      rfqId: true,
      status: true,
      businessAuthenticity: true,
      rfq: { select: { businessAuthenticity: true } },
    },
  });
  if (!quote) throw new Error("报价不存在");
  if (quote.status === "ACCEPTED" && value !== quote.rfq.businessAuthenticity) {
    throw new Error("已接受报价必须与所属 RFQ 保持相同业务真实性；请改为归类整个 RFQ");
  }

  await prisma.quote.update({ where: { id }, data: { businessAuthenticity: value } });
  await writeSecurityAudit({
    actorUserId,
    action: "QUOTE_BUSINESS_AUTHENTICITY_CHANGED",
    targetType: "Quote",
    targetId: id,
    summary: `Quote business authenticity: ${quote.businessAuthenticity} → ${value}`,
    metadata: { from: quote.businessAuthenticity, to: value, rfqId: quote.rfqId },
  });

  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/rfqs/${quote.rfqId}`);
  revalidatePath("/admin/analytics");
}


/**
 * Invitation-level classification. A REAL RFQ may contain a TEST invitation
 * created during workflow verification, so this fact is independently auditable.
 */
export async function setInvitationBusinessAuthenticity(id: number, value: string) {
  const session = await requireAdmin();
  assertBusinessAuthenticity(value);
  const actorUserId = Number((session.user as any).id) || null;

  const invitation = await prisma.rFQInvitation.findUnique({
    where: { id },
    select: { rfqId: true, businessAuthenticity: true },
  });
  if (!invitation) throw new Error("邀请不存在");

  await prisma.rFQInvitation.update({ where: { id }, data: { businessAuthenticity: value } });
  await writeSecurityAudit({
    actorUserId,
    action: "RFQ_INVITATION_BUSINESS_AUTHENTICITY_CHANGED",
    targetType: "RFQInvitation",
    targetId: id,
    summary: `RFQInvitation business authenticity: ${invitation.businessAuthenticity} → ${value}`,
    metadata: { from: invitation.businessAuthenticity, to: value, rfqId: invitation.rfqId },
  });

  revalidatePath(`/admin/rfqs/${invitation.rfqId}`);
  revalidatePath("/admin/analytics");
}
