import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canTransitionQuote } from "@/lib/quote-lifecycle";
import { canAcceptQuotes } from "@/lib/rfq-lifecycle";

type Db = Prisma.TransactionClient;

function ownsRfq(rfq: { userID: number | null; companyID: number | null }, buyer: { id: number; buyerCompanyId: number | null }) {
  return rfq.userID === buyer.id || (rfq.companyID !== null && rfq.companyID === buyer.buyerCompanyId);
}

/** Locks the RFQ first; all selection operations use this lock order. */
export async function acceptQuoteForBuyer(rfqId: number, quoteId: number, buyerUserId: number) {
  return prisma.$transaction(async (tx: Db) => {
    await tx.$queryRaw`SELECT "id" FROM "RFQ" WHERE "id" = ${rfqId} FOR UPDATE`;
    const [rfq, buyer] = await Promise.all([
      tx.rFQ.findUnique({ where: { id: rfqId }, select: { id: true, userID: true, companyID: true, status: true, businessAuthenticity: true } }),
      tx.user.findUnique({ where: { id: buyerUserId }, select: { id: true, role: true, buyerCompanyId: true, status: true } }),
    ]);
    if (!rfq) throw new Error("询价不存在");
    if (!buyer || buyer.role !== "BUYER" || buyer.status !== "ACTIVE" || !ownsRfq(rfq, buyer)) throw new Error("无权选择该询价的报价");
    if (!canAcceptQuotes(rfq.status)) throw new Error("该询价当前不能选择报价");

    const target = await tx.quote.findUnique({ where: { id: quoteId }, select: { id: true, rfqId: true, status: true, businessAuthenticity: true } });
    if (!target || target.rfqId !== rfqId) throw new Error("报价不属于该询价");
    if (rfq.businessAuthenticity === "UNKNOWN" || target.businessAuthenticity !== rfq.businessAuthenticity) {
      throw new Error("询价与报价的业务真实性未确认或不一致，不能选定");
    }
    if (!canTransitionQuote(target.status, "ACCEPTED")) throw new Error("该报价当前不能接受");

    const accepted = await tx.quote.count({ where: { rfqId, status: "ACCEPTED" } });
    if (accepted !== 0) throw new Error("该询价已存在已接受报价");

    const updated = await tx.quote.updateMany({ where: { id: quoteId, rfqId, status: "PENDING" }, data: { status: "ACCEPTED" } });
    if (updated.count !== 1) throw new Error("报价状态已变化，请刷新后重试");
    await tx.quote.updateMany({ where: { rfqId, id: { not: quoteId }, status: "PENDING" }, data: { status: "REJECTED" } });
    const rfqUpdated = await tx.rFQ.updateMany({ where: { id: rfqId, status: rfq.status }, data: { status: "SELECTED" } });
    if (rfqUpdated.count !== 1) throw new Error("询价状态已变化，请刷新后重试");
    return { rfqId, quoteId };
  });
}

export async function withdrawQuoteForSupplier(quoteId: number, supplierId: number) {
  return prisma.$transaction(async (tx: Db) => {
    const quote = await tx.quote.findUnique({ where: { id: quoteId }, include: { rfq: { select: { status: true } } } });
    if (!quote || quote.supplierId !== supplierId) throw new Error("无权撤回该报价");
    if (!["COLLECTING", "QUOTED"].includes(quote.rfq.status)) throw new Error("询价当前不能撤回报价");
    if (quote.status === "WITHDRAWN") return { idempotent: true };
    if (!canTransitionQuote(quote.status, "WITHDRAWN")) throw new Error("该报价当前不能撤回");
    const updated = await tx.quote.updateMany({ where: { id: quoteId, supplierId, status: "PENDING" }, data: { status: "WITHDRAWN" } });
    if (updated.count !== 1) throw new Error("报价状态已变化，请刷新后重试");
    return { idempotent: false };
  });
}
