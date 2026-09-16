import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildQuoteMatrix, buildSupplierColumns, type ComparisonItem, type ComparisonQuote } from "@/lib/rfq-comparison";

export const dynamic = "force-dynamic";

/**
 * 采购商报价导出（.xlsx）
 * 权限：仅 RFQ 发布者本人或管理员可导出；未登录 401；他人 403。
 * 数据：RFQ → RFQItem（行）→ Supplier（横向列组）→ QuoteItem（报价）。
 * Sheet1 报价比较：一个采购项目一行、每家供应商一组横向报价列（两层表头）。
 * Sheet2 询价明细：RFQItem 全量（无论是否有报价）。
 * Sheet3 供应商汇总：已报价项/覆盖率/币种，不做跨币种金额相加。
 * 件号一律按文本写入，防止 Excel 科学计数/前导 0 丢失；不做任何币种换算，不生成"最佳供应商"结论。
 */

const BASE_HEADER = ["序号", "件号", "产品名称", "品牌", "设备型号", "数量", "单位"];
const FIELD_GROUP = ["单价", "币种", "MOQ", "交期", "库存状态", "质保", "付款条件", "Incoterm", "质量等级", "备注"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ success: false, code: "BAD_REQUEST", message: "无效的询价 ID" }, { status: 400 });
  }

  const s = await auth();
  if (!s?.user) {
    return NextResponse.json({ success: false, code: "UNAUTHORIZED", message: "请先登录后再导出报价" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, code: "UNAUTHORIZED", message: "登录凭证无效，请重新登录" }, { status: 401 });
  }

  const rfq = await prisma.rFQ.findUnique({
    where: { id },
    include: {
      items: { include: { partNumber: true }, orderBy: { seq: "asc" } },
      quotes: { include: { supplier: true, items: { orderBy: { id: "asc" } } } },
    },
  });
  if (!rfq) {
    return NextResponse.json({ success: false, code: "NOT_FOUND", message: "询价不存在" }, { status: 404 });
  }

  // 服务端归属校验：发布者本人或管理员
  const isAdmin = user.role === "ADMIN";
  const isOwner = rfq.userID === user.id;
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ success: false, code: "FORBIDDEN", message: "无权导出该询价的报价" }, { status: 403 });
  }

  const items = rfq.items as ComparisonItem[];
  const allQuotes = rfq.quotes as ComparisonQuote[];
  // 只对"有有效报价"的供应商生成横向列组（未报价供应商不出现在报价比较中）
  const colQuotes = allQuotes.filter(
    (q) => q.items.some((x) => x.unitPrice != null) || q.unitPrice != null
  );
  if (colQuotes.length === 0) {
    return NextResponse.json({ success: false, code: "NO_QUOTES", message: "该询价暂无供应商报价" }, { status: 400 });
  }

  const supplierCols = buildSupplierColumns(colQuotes);
  const matrix = buildQuoteMatrix(items, allQuotes);
  const totalItems = items.length;
  const lastCol = BASE_HEADER.length + supplierCols.length * FIELD_GROUP.length; // 列数（0 基为 lastCol-1）
  const workbook = XLSX.utils.book_new();

  // ===== Sheet1 报价比较：两层表头 + RFQItem 行 × Supplier 横向列组 =====
  const aoa: (string | number)[][] = [];
  // 标题行 + 导出时间行
  aoa.push([`${rfq.rfqNo || `RFQ-${rfq.id}`} 报价比较`]);
  aoa.push([`导出时间：${new Date().toISOString().slice(0, 10)}`]);
  // 第一层表头：采购需求信息（合并 7 列）+ 每个供应商一组（合并 10 列）
  aoa.push([
    ...BASE_HEADER.map(() => "采购需求信息"),
    ...supplierCols.flatMap((sc) => [sc.name, ...Array(FIELD_GROUP.length - 1).fill("")]),
  ]);
  // 第二层表头：具体字段
  aoa.push([...BASE_HEADER, ...supplierCols.flatMap(() => FIELD_GROUP)]);
  // 数据行：一个 RFQItem 一行
  for (const item of items) {
    const partNo = item.partNumberStr || item.partNumber?.number || "";
    const row: (string | number)[] = [
      item.seq,
      partNo, // 文本写入，保留前导 0 与字母/横杠，避免科学计数
      item.productName || "",
      item.brandName || "",
      item.equipmentModel || "",
      item.quantity,
      item.unit || "",
    ];
    for (const q of colQuotes) {
      const qi = matrix[item.id]?.[q.id] || null;
      row.push(
        qi?.unitPrice ?? "未报价",
        qi?.currency || "—",
        qi?.moq ?? "—",
        qi?.leadTime || "—",
        qi?.stockStatus || "—",
        q.warranty || "—",
        q.paymentTerms || "—",
        q.incoterm || "—",
        qi?.quality || "—",
        qi?.remarks || "—"
      );
    }
    aoa.push(row);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(aoa);
  // 合并：标题行（A1:末列）、分组表头行（采购需求信息 A3:G3、每个供应商组）
  type CellAddr = { r: number; c: number };
  const merges: { s: CellAddr; e: CellAddr }[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: BASE_HEADER.length - 1 } },
  ];
  supplierCols.forEach((_, i) => {
    const start = BASE_HEADER.length + i * FIELD_GROUP.length;
    merges.push({ s: { r: 2, c: start }, e: { r: 2, c: start + FIELD_GROUP.length - 1 } });
  });
  ws1["!merges"] = merges;
  // 冻结窗格：冻结前 4 行（标题/时间/两层表头）+ 左侧 7 列（采购需求信息）
  ws1["!freeze"] = { xSplit: BASE_HEADER.length, ySplit: 4 };
  // 自动筛选：从字段表头行（第 4 行）到数据末行
  const lastRow = aoa.length - 1;
  ws1["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: lastRow, c: lastCol - 1 } }) };
  // 列宽：件号加宽、备注限宽，避免超长文本无限拉宽
  const widths: number[] = [...BASE_HEADER.map((h, i) => (i === 1 ? 22 : h === "产品名称" ? 18 : 10))];
  supplierCols.forEach(() => {
    FIELD_GROUP.forEach((f, i) => {
      widths.push(i === 0 ? 12 : f === "备注" ? 30 : f === "付款条件" ? 14 : f === "库存状态" ? 12 : f === "币种" ? 8 : 10);
    });
  });
  ws1["!cols"] = widths.map((w) => ({ wch: Math.min(Math.max(w, 8), 40) }));
  XLSX.utils.book_append_sheet(workbook, ws1, "报价比较");

  // ===== Sheet2 询价明细：RFQItem 全量（恒等于采购明细条数）=====
  const rows2: (string | number)[][] = [["序号", "件号", "产品名称", "品牌", "设备型号", "数量", "单位", "描述"]];
  for (const item of items) {
    rows2.push([
      item.seq,
      item.partNumberStr || item.partNumber?.number || "",
      item.productName || "",
      item.brandName || "",
      item.equipmentModel || "",
      item.quantity,
      item.unit || "",
      item.description || "",
    ]);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  ws2["!freeze"] = { xSplit: 1, ySplit: 1 };
  ws2["!cols"] = [8, 22, 18, 10, 12, 8, 8, 30].map((w) => ({ wch: Math.min(Math.max(w, 8), 40) }));
  ws2["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows2.length - 1, c: 7 } }) };
  XLSX.utils.book_append_sheet(workbook, ws2, "询价明细");

  // ===== Sheet3 供应商汇总 =====
  const rows3: (string | number)[][] = [["供应商", "已报价项", "总项目", "报价覆盖率", "报价币种", "状态", "备注"]];
  for (const q of colQuotes) {
    const quotedItems = q.items.filter((x) => x.unitPrice != null);
    const cnt = quotedItems.length;
    const coverage = totalItems > 0 ? `${((cnt / totalItems) * 100).toFixed(2)}%` : "0.00%";
    const currencies = Array.from(new Set(quotedItems.map((x) => x.currency || "CNY"))).join(" / ");
    rows3.push([
      q.supplier.shortName || q.supplier.name || "",
      cnt,
      totalItems,
      coverage,
      currencies || q.currency || "CNY",
      q.status || "PENDING",
      q.remarks || "",
    ]);
  }
  const ws3 = XLSX.utils.aoa_to_sheet(rows3);
  ws3["!freeze"] = { xSplit: 1, ySplit: 1 };
  ws3["!cols"] = [18, 10, 10, 12, 12, 10, 30].map((w) => ({ wch: Math.min(Math.max(w, 8), 40) }));
  ws3["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows3.length - 1, c: 6 } }) };
  XLSX.utils.book_append_sheet(workbook, ws3, "供应商汇总");

  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  // 文件名：rfqNo 已含 RFQ- 前缀（如 RFQ-20260916-003），不再重复拼接 RFQ-
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileBase = `${rfq.rfqNo || `${rfq.id}-${dateStr}`}_报价比较`;
  const filename = `${fileBase}.xlsx`;
  // 中文文件名：RFC 5987 编码 + ASCII fallback
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="RFQ-export.xlsx"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-store",
    },
  });
}
