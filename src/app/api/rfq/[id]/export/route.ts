import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * 采购商报价导出（.xlsx）
 * 权限：仅 RFQ 发布者本人或管理员可导出；未登录 401；他人 403。
 * 数据：RFQItem × QuoteItem × Supplier 逐行组合，件号一律按文本写入，防止 Excel 科学计数/前导 0 丢失。
 */
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

  const quoted = rfq.quotes.filter((q) => q.items.length > 0 || q.unitPrice != null);
  if (quoted.length === 0) {
    return NextResponse.json({ success: false, code: "NO_QUOTES", message: "该询价暂无供应商报价" }, { status: 400 });
  }

  // Sheet1 报价比较：逐件号 × 逐供应商（仅基于 QuoteItem 新结构）
  const header1 = [
    "序号", "件号", "产品名称", "品牌", "设备型号", "数量", "单位",
    "供应商", "单价", "币种", "MOQ", "交期", "库存状态", "质保", "付款条件", "Incoterm", "质量等级", "备注",
  ];
  const rows1: (string | number)[][] = [header1];
  for (const item of rfq.items) {
    const partNo = item.partNumberStr || item.partNumber?.number || "";
    for (const q of quoted) {
      const qi = q.items.find((x) => x.rfqItemId === item.id);
      if (!qi || qi.unitPrice == null) continue;
      rows1.push([
        item.seq,
        partNo, // 文本写入，保留前导 0 与字母/横杠，避免科学计数
        item.productName || "",
        item.brandName || "",
        item.equipmentModel || "",
        item.quantity,
        item.unit || "",
        q.supplier.shortName || q.supplier.name || "",
        qi.unitPrice,
        qi.currency || "CNY",
        qi.moq ?? "",
        qi.leadTime || "",
        qi.stockStatus || "",
        q.warranty || "",
        q.paymentTerms || "",
        q.incoterm || "",
        qi.quality || "",
        qi.remarks || "",
      ]);
    }
  }

  // Sheet2 询价明细
  const header2 = ["序号", "件号", "产品名称", "品牌", "设备型号", "数量", "单位", "描述"];
  const rows2: (string | number)[][] = [header2];
  for (const item of rfq.items) {
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

  // Sheet3 供应商报价汇总（含旧结构总价兼容）
  const header3 = ["供应商", "已报价项", "总项目", "报价类型", "总额", "币种", "状态", "备注"];
  const rows3: (string | number)[][] = [header3];
  for (const q of quoted) {
    const hasItems = q.items.length > 0;
    const type = hasItems
      ? (q.totalAmount != null && q.quotedCount >= rfq.items.length ? "完整报价" : `部分报价 ${q.quotedCount}/${rfq.items.length} 项`)
      : "历史总价";
    rows3.push([
      q.supplier.shortName || q.supplier.name || "",
      hasItems ? q.quotedCount : (q.unitPrice != null ? "1" : "0"),
      rfq.items.length,
      type,
      hasItems ? (q.totalAmount ?? "") : (q.unitPrice ?? ""),
      q.items[0]?.currency || q.currency || "CNY",
      q.status || "PENDING",
      q.remarks || "",
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(rows1);
  ws1["!cols"] = header1.map((h, i) => ({ wch: i === 1 ? 22 : i === 8 || i === 9 ? 12 : 14 }));
  XLSX.utils.book_append_sheet(wb, ws1, "报价比较");
  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  ws2["!cols"] = header2.map((h, i) => ({ wch: i === 1 ? 22 : 14 }));
  XLSX.utils.book_append_sheet(wb, ws2, "询价明细");
  const ws3 = XLSX.utils.aoa_to_sheet(rows3);
  ws3["!cols"] = header3.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws3, "供应商汇总");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileBase = `RFQ-${rfq.rfqNo || `${rfq.id}-${dateStr}`}_报价比较`;
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
