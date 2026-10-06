import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canSupplierAccessRfq } from "@/lib/rfq-supplier-access";
import { markInvitationQuoted } from "@/lib/rfq-invitation";
import { canTransitionRfq } from "@/lib/rfq-lifecycle";
import { writeBusinessEvent } from "@/lib/analytics";
import { resolveSupplierWriteAccess } from "@/lib/supplier-write-access";
import { splitStoredUploadUrls, uploadPrincipal, uploadUrlsBelongToPrincipal } from "@/lib/upload-policy";

export async function POST(req: NextRequest) {
  // ===== 1. Canonical supplier write authorization =====
  const access = await resolveSupplierWriteAccess("BUSINESS");
  if (!access.ok) return NextResponse.json({ error: access.message, code: access.code }, { status: access.status });
  const uid = access.userId;
  const supplierId = access.supplierId;

  const formData = await req.formData();
  const rfqId = parseInt(String(formData.get("rfqId") || ""));
  if (!rfqId) return NextResponse.json({ error: "缺少询价单 ID" }, { status: 400 });

  // ===== 2. RFQ 可见性校验 =====
  const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId } });
  if (!rfq) return NextResponse.json({ error: "询价单不存在" }, { status: 404 });
  if (!canSupplierAccessRfq(rfq, supplierId)) {
    return NextResponse.json({ error: "无权访问该询价或提交报价", code: "FORBIDDEN" }, { status: 403 });
  }
  if (!["COLLECTING", "QUOTED"].includes(rfq.status)) {
    return NextResponse.json({ error: "该询价已关闭，无法报价" }, { status: 400 });
  }

  // ===== 3. 解析分项报价 =====
  let items: {
    rfqItemId: number;
    unitPrice: number;
    currency: string;
    leadTime: string | null;
    quality: string | null;
    remarks: string | null;
  }[] = [];
  const rawItems = String(formData.get("items") || "[]");
  try {
    items = JSON.parse(rawItems);
    if (!Array.isArray(items)) throw new Error("bad items");
  } catch {
    return NextResponse.json({ error: "报价数据格式错误" }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "请至少提交一项报价" }, { status: 400 });
  }
  for (const it of items) {
    if (!it.rfqItemId || !(it.unitPrice > 0)) {
      return NextResponse.json({ error: "存在无效的报价明细（缺少明细或单价无效）" }, { status: 400 });
    }
  }
  if (new Set(items.map((it) => it.rfqItemId)).size !== items.length) {
    return NextResponse.json({ error: "同一询价明细只能提交一次报价" }, { status: 400 });
  }

  let attachments: string[] = [];
  const rawAtt = String(formData.get("attachments") || "[]");
  try {
    attachments = JSON.parse(rawAtt);
    if (!Array.isArray(attachments)) attachments = [];
  } catch {
    attachments = [];
  }
  attachments = splitStoredUploadUrls(attachments);
  const previousQuote = await prisma.quote.findFirst({
    where: { rfqId, supplierId },
    select: { attachments: true },
  });
  const previousAttachments = splitStoredUploadUrls(previousQuote?.attachments);
  const attachmentPrincipal = uploadPrincipal("SUPPLIER", supplierId);
  if (!uploadUrlsBelongToPrincipal(attachments, "quote-attachment", attachmentPrincipal, previousAttachments)) {
    return NextResponse.json({ error: "报价附件不属于当前供应商或上传用途无效" }, { status: 400 });
  }

  // token 仅用于归因；邀请必须已绑定当前供应商，不授予 RFQ 访问权限。
  const invitationToken = String(formData.get("invitationToken") || "").trim();

  try {
    // ===== 4. 校验 RFQItem 归属 =====
    const itemIds = items.map((i) => i.rfqItemId);
    const dbItems = await prisma.rFQItem.findMany({
      where: { id: { in: itemIds }, rfqId },
      select: { id: true, quantity: true },
    });
    if (dbItems.length !== itemIds.length) {
      return NextResponse.json({ error: "报价明细与询价单不匹配" }, { status: 400 });
    }
    const qtyMap = new Map(dbItems.map((d) => [d.id, d.quantity]));

    // ===== 5. 事务：创建/更新 Quote + 替换 QuoteItems + 计算汇总 =====
    const result = await prisma.$transaction(async (tx) => {
      // Serialize all submissions for this RFQ before checking its lifecycle or unique quote.
      await tx.$queryRaw`SELECT "id" FROM "RFQ" WHERE "id" = ${rfqId} FOR UPDATE`;
      const lockedRfq = await tx.rFQ.findUnique({ where: { id: rfqId } });
      if (!lockedRfq || !canSupplierAccessRfq(lockedRfq, supplierId) || !["COLLECTING", "QUOTED"].includes(lockedRfq.status)) {
        throw new Error("询价当前不能提交报价");
      }
      // The RFQ row lock serializes competing submissions; the migration's
      // unique(rfqId,supplierId) is the independent database backstop.
      const existing = await tx.quote.findFirst({ where: { rfqId, supplierId } });
      if (existing && existing.status !== "PENDING") throw new Error("终态报价不能修改或重新提交");
      const quote =
        existing ||
        (await tx.quote.create({
          data: {
            rfqId,
            supplierId,
            status: "PENDING",
            // Inherit the RFQ fact classification. Historical UNKNOWN stays UNKNOWN;
            // TEST RFQs can never create REAL quotes by accident.
            businessAuthenticity: lockedRfq.businessAuthenticity,
          },
        }));

      if (existing) {
        await tx.quoteItem.deleteMany({ where: { quoteId: quote.id } });
      }

      // 逐项报价
      let sum = 0;
      const currencies = new Set<string>();
      for (const it of items) {
        const qty = qtyMap.get(it.rfqItemId) ?? 1;
        const currency = (it.currency || "CNY").toUpperCase();
        currencies.add(currency);
        sum += it.unitPrice * qty;
        await tx.quoteItem.create({
          data: {
            quoteId: quote.id,
            rfqItemId: it.rfqItemId,
            unitPrice: it.unitPrice,
            currency,
            quantity: qty,
            leadTime: it.leadTime || null,
            quality: it.quality || null,
            remarks: it.remarks || null,
          },
        });
      }

      // quotedCount / totalAmount：全部 Item 有报价且币种一致才给总价，否则 null
      const totalItems = await tx.rFQItem.count({ where: { rfqId } });
      const allQuoted = items.length >= totalItems;
      const totalAmount =
        allQuoted && currencies.size === 1 && sum > 0 ? sum : null;

      const updated = await tx.quote.update({
        where: { id: quote.id },
        data: {
          quotedCount: items.length,
          totalAmount,
          attachments: attachments.length ? JSON.stringify(attachments) : null,
          unitPrice: null, // 旧总报价字段置空，统一走分项
          leadTime: null,
        },
      });

      if (lockedRfq.status === "COLLECTING" && canTransitionRfq("COLLECTING", "QUOTED")) {
        await tx.rFQ.update({ where: { id: rfqId }, data: { status: "QUOTED" } });
      }

      // 仅相同 RFQ、相同已绑定供应商且生命周期允许的邀请可标记 QUOTED。
      if (invitationToken) {
        await markInvitationQuoted(invitationToken, rfqId, supplierId, tx);
      }
      return { updated, created: !existing };
    });

    if (result.created) {
      await writeBusinessEvent({ eventType: "QUOTE_CREATE", path: `/rfq/${rfqId}/quote`, userId: uid, entityType: "Quote", entityId: result.updated.id, metadata: { rfqId, supplierId, businessAuthenticity: result.updated.businessAuthenticity } });
    }
    return NextResponse.json({ ok: true, quoteId: result.updated.id });
  } catch (e) {
    console.error("【提交报价失败】:", e);
    return NextResponse.json({ error: "提交失败，请稍后重试" }, { status: 500 });
  }
}
