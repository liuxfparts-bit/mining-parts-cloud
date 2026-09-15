import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // ===== 1. Session 鉴权：绝不信任 URL/表单传入的 supplierId =====
  const s = await auth();
  if (!s?.user) {
    return NextResponse.json(
      { error: "登录凭证已过期，请重新登录", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  const role = (s.user as any).role;
  if (role !== "SUPPLIER") {
    return NextResponse.json({ error: "仅供应商可提交报价", code: "FORBIDDEN" }, { status: 403 });
  }
  const uid = parseInt(String((s.user as any).id));
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { supplierId: true },
  });
  if (!user?.supplierId) {
    return NextResponse.json({ error: "账号未绑定供应商资料", code: "FORBIDDEN" }, { status: 403 });
  }
  const supplierId = user.supplierId;

  const formData = await req.formData();
  const rfqId = parseInt(String(formData.get("rfqId") || ""));
  if (!rfqId) return NextResponse.json({ error: "缺少询价单 ID" }, { status: 400 });

  // ===== 2. RFQ 可见性校验 =====
  const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId } });
  if (!rfq) return NextResponse.json({ error: "询价单不存在" }, { status: 404 });
  if (rfq.status === "CLOSED" || rfq.status === "EXPIRED") {
    return NextResponse.json({ error: "该询价已关闭，无法报价" }, { status: 400 });
  }
  if (rfq.visibility === "MATCHED_SUPPLIERS" && rfq.matchedSuppliers) {
    try {
      const matched: number[] = JSON.parse(rfq.matchedSuppliers);
      if (Array.isArray(matched) && !matched.includes(supplierId)) {
        return NextResponse.json({ error: "该询价仅向匹配的供应商开放", code: "FORBIDDEN" }, { status: 403 });
      }
    } catch {
      /* 兼容脏数据：解析失败不拦截 */
    }
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

  let attachments: string[] = [];
  const rawAtt = String(formData.get("attachments") || "[]");
  try {
    attachments = JSON.parse(rawAtt);
    if (!Array.isArray(attachments)) attachments = [];
  } catch {
    attachments = [];
  }

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
      const existing = await tx.quote.findFirst({ where: { rfqId, supplierId } });
      const quote =
        existing ||
        (await tx.quote.create({
          data: { rfqId, supplierId, status: "PENDING" },
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

      if (rfq.status === "COLLECTING") {
        await tx.rFQ.update({ where: { id: rfqId }, data: { status: "QUOTED" } });
      }
      return updated;
    });

    return NextResponse.json({ ok: true, quoteId: result.id });
  } catch (e) {
    console.error("【提交报价失败】:", e);
    return NextResponse.json({ error: "提交失败，请稍后重试" }, { status: 500 });
  }
}
