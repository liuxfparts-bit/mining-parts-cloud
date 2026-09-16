import type { PartNumber, Quote, QuoteItem, RFQItem, Supplier } from "@prisma/client";

/**
 * 报价比较公共数据层
 * 网页"分项比价"与 Excel"报价比较"导出共用同一套组装逻辑：
 *   RFQItem 决定行，Supplier 决定列组，QuoteItem 决定报价值。
 * 不修改任何原始报价数据，仅做读取与组装。
 */

export type ComparisonQuote = Quote & { supplier: Supplier; items: QuoteItem[] };
export type ComparisonItem = RFQItem & { partNumber?: PartNumber | null };

/** 供应商列组：有效报价的供应商（有 QuoteItem 单价或旧结构总价） */
export function buildSupplierColumns(quotes: ComparisonQuote[]): { quoteId: number; name: string }[] {
  return quotes
    .filter((q) => q.items.some((x) => x.unitPrice != null) || q.unitPrice != null)
    .map((q) => ({ quoteId: q.id, name: q.supplier.shortName || q.supplier.name || "供应商" }));
}

/** 报价矩阵：rfqItemId → (quoteId → QuoteItem | null)；未报价为 null */
export function buildQuoteMatrix(
  items: ComparisonItem[],
  quotes: ComparisonQuote[]
): Record<number, Record<number, QuoteItem | null>> {
  const matrix: Record<number, Record<number, QuoteItem | null>> = {};
  for (const item of items) {
    const row: Record<number, QuoteItem | null> = {};
    for (const q of quotes) {
      const qi = q.items.find((x) => x.rfqItemId === item.id);
      row[q.id] = qi && qi.unitPrice != null ? qi : null;
    }
    matrix[item.id] = row;
  }
  return matrix;
}

export type RankCell = { price: number; currency: string; rank: number | null };

/**
 * 分项价格排名：同一 RFQItem + 同一币种，unitPrice 从低到高排序。
 * 无报价供应商不参与排名；不同币种不互相比较。最低价仅代表价格第 1 名。
 */
export function buildItemRanks(
  items: ComparisonItem[],
  quotes: ComparisonQuote[]
): Record<number, Record<number, RankCell>> {
  const itemRanks: Record<number, Record<number, RankCell>> = {};
  for (const item of items) {
    const cells: { qId: number; price: number; currency: string }[] = [];
    for (const q of quotes) {
      const qi = q.items.find((x) => x.rfqItemId === item.id);
      if (qi?.unitPrice != null) cells.push({ qId: q.id, price: qi.unitPrice, currency: qi.currency || "CNY" });
    }
    const byCur = new Map<string, { qId: number; price: number }[]>();
    for (const c of cells) {
      if (!byCur.has(c.currency)) byCur.set(c.currency, []);
      byCur.get(c.currency)!.push({ qId: c.qId, price: c.price });
    }
    const row: Record<number, RankCell> = {};
    for (const cur of Array.from(byCur.keys())) {
      const arr = byCur.get(cur)!;
      const sorted = [...arr].sort((a, b) => a.price - b.price);
      sorted.forEach((p, idx) => {
        row[p.qId] = { price: p.price, currency: cur, rank: idx + 1 };
      });
    }
    itemRanks[item.id] = row;
  }
  return itemRanks;
}

/** 有效报价供应商数量（有 QuoteItem 单价或旧结构总价） */
export function quotedSupplierCount(quotes: ComparisonQuote[]): number {
  return quotes.filter((q) => q.items.some((x) => x.unitPrice != null) || q.unitPrice != null).length;
}
