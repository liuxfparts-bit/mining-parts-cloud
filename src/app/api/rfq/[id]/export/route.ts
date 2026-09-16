import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildQuoteMatrix, buildSupplierColumns, type ComparisonItem, type ComparisonQuote } from "@/lib/rfq-comparison";

export const dynamic = "force-dynamic";

/**
 * 采购商报价导出（.xlsx，exceljs）
 * 权限：仅 RFQ 发布者本人或管理员可导出；未登录 401；他人 403。
 * 数据：RFQ → RFQItem（行）→ Supplier（横向列组）→ QuoteItem（报价）。
 * Sheet1 报价比较：一个采购项目一行、每家供应商一组横向报价列（两层表头、冻结窗格、自动筛选、列宽）。
 * Sheet2 询价明细：RFQItem 全量（无论是否有报价）。
 * Sheet3 供应商汇总：已报价项/覆盖率/币种，不做跨币种金额相加。
 * 件号一律按文本写入（numFmt '@'），防止 Excel 科学计数/前导 0 丢失；
 * 不做任何币种换算，不生成"最佳供应商"结论。
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
  const colQuotes = allQuotes.filter(
    (q) => q.items.some((x) => x.unitPrice != null) || q.unitPrice != null
  );
  if (colQuotes.length === 0) {
    return NextResponse.json({ success: false, code: "NO_QUOTES", message: "该询价暂无供应商报价" }, { status: 400 });
  }

  const supplierCols = buildSupplierColumns(colQuotes);
  const matrix = buildQuoteMatrix(items, allQuotes);
  const totalItems = items.length;
  const lastCol = BASE_HEADER.length + supplierCols.length * FIELD_GROUP.length;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "矿配云";
  workbook.created = new Date();

  // ===== Sheet1 报价比较 =====
  const ws1 = workbook.addWorksheet("报价比较", {
    views: [{ state: "frozen", xSplit: BASE_HEADER.length, ySplit: 4 }], // 冻结左侧 7 列 + 表头 4 行
  });
  // 列宽：件号加宽、备注限宽
  const widths: number[] = [6, 22, 18, 12, 12, 8, 8];
  supplierCols.forEach(() => {
    FIELD_GROUP.forEach((f, i) => {
      widths.push(i === 0 ? 12 : f === "备注" ? 30 : f === "付款条件" ? 14 : f === "库存状态" ? 12 : f === "币种" ? 8 : 10);
    });
  });
  widths.forEach((w, i) => {
    ws1.getColumn(i + 1).width = Math.min(Math.max(w, 6), 40);
  });

  // 标题行 + 导出时间行
  const titleRow = ws1.addRow([`${rfq.rfqNo || `RFQ-${rfq.id}`} 报价比较`]);
  titleRow.getCell(1).font = { bold: true, size: 14 };
  ws1.addRow([`导出时间：${new Date().toISOString().slice(0, 10)}`]);
  // 第一层表头：采购需求信息 + 每个供应商一组
  ws1.addRow([
    ...BASE_HEADER.map(() => "采购需求信息"),
    ...supplierCols.flatMap((sc) => [sc.name, ...Array(FIELD_GROUP.length - 1).fill("")]),
  ]);
  // 第二层表头：具体字段
  ws1.addRow([...BASE_HEADER, ...supplierCols.flatMap(() => FIELD_GROUP)]);

  // 合并：标题行 A1:末列、分组表头行（采购需求信息 + 各供应商组）
  ws1.mergeCells(1, 1, 1, lastCol);
  ws1.mergeCells(3, 1, 3, BASE_HEADER.length);
  supplierCols.forEach((_, i) => {
    const start = BASE_HEADER.length + i * FIELD_GROUP.length;
    ws1.mergeCells(3, start + 1, 3, start + FIELD_GROUP.length);
  });
  // 表头样式
  const groupRow = ws1.getRow(3);
  groupRow.font = { bold: true };
  groupRow.alignment = { horizontal: "center", vertical: "middle" };
  groupRow.height = 22;
  const fieldRow = ws1.getRow(4);
  fieldRow.font = { bold: true };
  fieldRow.alignment = { horizontal: "center", vertical: "middle" };
  fieldRow.height = 20;

  // 数据行：一个 RFQItem 一行
  for (const item of items) {
    const partNo = item.partNumberStr || item.partNumber?.number || "";
    const row: (string | number)[] = [
      item.seq,
      partNo, // 字符串写入，保留前导 0 与字母/横杠
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
    const r = ws1.addRow(row);
    // 件号列（第 2 列）强制文本格式，防止前导 0 丢失/科学计数
    r.getCell(2).numFmt = "@";
  }
  // 自动筛选：从字段表头行（第 4 行）到数据末行
  ws1.autoFilter = { from: { row: 4, column: 1 }, to: { row: ws1.rowCount, column: lastCol } };
  ws1.getRow(1).height = 24;

  // ===== Sheet2 询价明细：RFQItem 全量 =====
  const ws2 = workbook.addWorksheet("询价明细", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
  });
  [8, 22, 18, 12, 12, 8, 8, 30].forEach((w, i) => {
    ws2.getColumn(i + 1).width = Math.min(Math.max(w, 6), 40);
  });
  ws2.addRow(["序号", "件号", "产品名称", "品牌", "设备型号", "数量", "单位", "描述"]);
  ws2.getRow(1).font = { bold: true };
  for (const item of items) {
    const r = ws2.addRow([
      item.seq,
      item.partNumberStr || item.partNumber?.number || "",
      item.productName || "",
      item.brandName || "",
      item.equipmentModel || "",
      item.quantity,
      item.unit || "",
      item.description || "",
    ]);
    r.getCell(2).numFmt = "@";
  }
  ws2.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws2.rowCount, column: 8 } };

  // ===== Sheet3 供应商汇总 =====
  const ws3 = workbook.addWorksheet("供应商汇总", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
  });
  [18, 10, 10, 12, 14, 10, 30].forEach((w, i) => {
    ws3.getColumn(i + 1).width = Math.min(Math.max(w, 6), 40);
  });
  ws3.addRow(["供应商", "已报价项", "总项目", "报价覆盖率", "报价币种", "状态", "备注"]);
  ws3.getRow(1).font = { bold: true };
  for (const q of colQuotes) {
    const quotedItems = q.items.filter((x) => x.unitPrice != null);
    const cnt = quotedItems.length;
    const coverage = totalItems > 0 ? `${((cnt / totalItems) * 100).toFixed(2)}%` : "0.00%";
    const currencies = Array.from(new Set(quotedItems.map((x) => x.currency || "CNY"))).join(" / ");
    ws3.addRow([
      q.supplier.shortName || q.supplier.name || "",
      cnt,
      totalItems,
      coverage,
      currencies || q.currency || "CNY",
      q.status || "PENDING",
      q.remarks || "",
    ]);
  }
  ws3.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws3.rowCount, column: 7 } };

  const buf = await workbook.xlsx.writeBuffer();

  // 文件名：rfqNo 已含 RFQ- 前缀（如 RFQ-20260916-003），不再重复拼接 RFQ-
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileBase = `${rfq.rfqNo || `${rfq.id}-${dateStr}`}_报价比较`;
  const filename = `${fileBase}.xlsx`;
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);

  return new NextResponse(Buffer.from(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="RFQ-export.xlsx"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-store",
    },
  });
}
