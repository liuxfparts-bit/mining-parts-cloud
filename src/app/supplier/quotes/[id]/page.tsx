export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import RfqImages from "@/components/RfqImages";
import { FileText } from "lucide-react";

const QUOTE_STATUS_CN: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "已提交 · 采购商比价中", cls: "bg-blue-50 text-blue-700" },
  ACCEPTED: { label: "已中标", cls: "bg-green-50 text-green-700" },
  REJECTED: { label: "未中标", cls: "bg-gray-100 text-gray-500" },
  WITHDRAWN: { label: "已撤回", cls: "bg-red-50 text-red-600" },
};

function parseList(v: string | null): string[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && x) : [];
  } catch {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export default async function SupplierQuoteDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((session.user as any).email).toLowerCase() },
    select: { supplierId: true },
  });
  if (!user?.supplierId) redirect("/supplier");

  // ===== 服务端归属校验：只能查看自己提交的报价（防止修改 URL 越权看其他供应商报价）=====
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      rfq: {
        select: {
          id: true,
          title: true,
          rfqNo: true,
          status: true,
          contactName: true,
          contactPhone: true,
          deliveryLocation: true,
          expiresAt: true,
          createdAt: true,
          images: true,
          attachments: true,
          _count: { select: { items: true } },
        },
      },
      items: {
        include: { rfqItem: { include: { partNumber: true } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!quote || quote.supplierId !== user.supplierId) notFound();

  const st = QUOTE_STATUS_CN[quote.status] || { label: quote.status, cls: "bg-gray-100 text-gray-500" };
  const totalItems = quote.rfq._count.items;
  const rfqImages = parseList(quote.rfq.images);
  const attachments = parseList(quote.attachments);
  const amount =
    quote.totalAmount != null
      ? quote.totalAmount.toLocaleString()
      : quote.items.length > 0
        ? "部分报价"
        : quote.unitPrice != null
          ? quote.unitPrice.toLocaleString()
          : "—";
  const currency =
    quote.totalAmount != null ? quote.items[0]?.currency || quote.currency : quote.items[0]?.currency || quote.currency;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/supplier/quotes" className="text-sm text-slate-500 hover:text-blue-600">← 返回已投报价</Link>
        <h1 className="text-xl font-bold mt-1 flex items-center gap-2 flex-wrap">
          报价详情
          <span className={`inline-block text-xs px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
        </h1>
        <p className="text-xs font-mono text-slate-400 mt-0.5">
          {quote.rfq.rfqNo || `#${quote.rfq.id}`} · {quote.rfq.title}
        </p>
      </div>

      {/* 询价信息 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <h2 className="font-semibold text-sm text-slate-700 mb-3">询价信息</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-400 block">采购商</span>
            <span className="text-slate-700">{quote.rfq.contactName || "—"}</span>
            {quote.rfq.contactPhone && <span className="text-xs text-slate-400 block mt-0.5">{quote.rfq.contactPhone}</span>}
          </div>
          <div>
            <span className="text-xs text-slate-400 block">询价状态</span>
            <span className="text-slate-700">{quote.rfq.status || "—"}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">报价截止</span>
            <span className="text-slate-700">
              {quote.rfq.expiresAt ? new Date(quote.rfq.expiresAt).toLocaleString("zh-CN") : "长期有效"}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">发布时间</span>
            <span className="text-slate-700">{new Date(quote.rfq.createdAt).toLocaleString("zh-CN")}</span>
          </div>
          {quote.rfq.deliveryLocation && (
            <div>
              <span className="text-xs text-slate-400 block">交货地点</span>
              <span className="text-slate-700">{quote.rfq.deliveryLocation}</span>
            </div>
          )}
        </div>
      </div>

      {/* 报价汇总 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <h2 className="font-semibold text-sm text-slate-700 mb-3">报价汇总</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-400 block">报价明细</span>
            <span className="text-slate-700 font-semibold">
              {quote.quotedCount}/{totalItems} 项
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">报价金额</span>
            <span className="text-slate-800 font-mono font-semibold">{amount}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">币种</span>
            <span className="text-slate-700">{currency}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">报价时间</span>
            <span className="text-slate-700">{new Date(quote.createdAt).toLocaleString("zh-CN")}</span>
          </div>
        </div>
        {(rfqImages.length > 0 || attachments.length > 0) && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-400 mb-1.5">询价图片 / 附件</div>
            {rfqImages.length > 0 && <RfqImages urls={rfqImages} />}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((u) => (
                  <a
                    key={u}
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 border rounded px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100"
                  >
                    <FileText className="w-3 h-3 text-slate-400" />
                    <span className="max-w-[180px] truncate text-blue-600">{u.split("/").pop()}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 分项报价明细 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 overflow-x-auto">
        <h2 className="font-semibold text-sm text-slate-700 mb-3">报价明细（{quote.items.length} 项）</h2>
        {quote.items.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">该报价无分项明细（旧版单件号报价）</p>
        ) : (
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-200">
                <th className="py-2 pr-2">序号</th>
                <th className="py-2 px-2">件号</th>
                <th className="py-2 px-2">配件名称</th>
                <th className="py-2 px-2">品牌 / 设备</th>
                <th className="py-2 px-2 text-center">采购数量</th>
                <th className="py-2 px-2">单价</th>
                <th className="py-2 px-2">币种</th>
                <th className="py-2 px-2">交期</th>
                <th className="py-2 px-2">质量等级</th>
                <th className="py-2 pl-2">备注</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((qi) => (
                <tr key={qi.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2 whitespace-nowrap">
                    <span className="text-xs font-bold bg-slate-100 rounded px-1.5 py-0.5">
                      {qi.rfqItem.seq}
                    </span>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs text-slate-700 whitespace-nowrap">
                    {qi.rfqItem.partNumberStr || qi.rfqItem.partNumber?.number || "—"}
                  </td>
                  <td className="py-2 px-2 text-xs text-slate-700">{qi.rfqItem.productName || "—"}</td>
                  <td className="py-2 px-2 text-xs text-slate-500">
                    {[qi.rfqItem.brandName, qi.rfqItem.equipmentModel].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="py-2 px-2 text-center whitespace-nowrap text-xs">
                    {qi.rfqItem.quantity} {qi.rfqItem.unit || "pcs"}
                  </td>
                  <td className="py-2 px-2 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                    {qi.unitPrice != null ? qi.unitPrice.toLocaleString() : "—"}
                  </td>
                  <td className="py-2 px-2 text-xs text-slate-500">{qi.currency}</td>
                  <td className="py-2 px-2 text-xs text-slate-500">{qi.leadTime || "—"}</td>
                  <td className="py-2 px-2 text-xs text-slate-500">{qi.quality || "—"}</td>
                  <td className="py-2 pl-2 text-xs text-slate-500 max-w-[180px]">
                    {qi.remarks || <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex gap-3">
        <Link
          href={`/supplier/rfqs/${quote.rfq.id}`}
          className="inline-block bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700"
        >
          修改报价
        </Link>
        <Link
          href="/supplier/quotes"
          className="inline-block border border-slate-200 text-slate-600 text-sm px-5 py-2 rounded-lg hover:bg-slate-50"
        >
          返回已投报价
        </Link>
      </div>
    </div>
  );
}
