export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Building2, FileText, Paperclip } from "lucide-react";

const statusMap: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "待处理", cls: "bg-amber-50 text-amber-700" },
  ACCEPTED: { label: "已接受", cls: "bg-green-50 text-green-700" },
  REJECTED: { label: "已拒绝", cls: "bg-red-50 text-red-600" },
  WITHDRAWN: { label: "已撤回", cls: "bg-gray-100 text-gray-500" },
};

function parseAttachments(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v;
  } catch {
    /* ignore */
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

const qualityMap: Record<string, string> = {
  OEM: "原厂 OEM",
  OEM_COMPATIBLE: "OEM 兼容",
  AFTERMARKET: "后市场",
  REPLACEMENT: "替代件",
  OTHER: "其他",
};

export default async function QuoteDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, buyerCompanyId: true },
  });
  if (!user) redirect("/login");

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      rfq: {
        include: {
          items: { orderBy: { seq: "asc" }, take: 3, select: { id: true, seq: true, partNumberStr: true, productName: true } },
          _count: { select: { items: true } },
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
          slug: true,
          contactName: true,
          mobile: true,
          telephone: true,
          email: true,
          wechat: true,
          whatsapp: true,
          mainBrands: true,
          mainEquipment: true,
          mainBusiness: true,
        },
      },
      items: {
        include: { rfqItem: true },
        orderBy: { rfqItem: { seq: "asc" } },
      },
    },
  });
  if (!quote || !quote.rfq) notFound();

  // 服务端归属校验：仅发布者本人或同企业成员可查看（防止横向越权）
  const sameCompany =
    quote.rfq.companyID != null && user.buyerCompanyId != null && quote.rfq.companyID === user.buyerCompanyId;
  if (quote.rfq.userID !== user.id && !sameCompany) notFound();

  const st = statusMap[quote.status] || { label: quote.status, cls: "bg-gray-100 text-gray-600" };
  const attachments = parseAttachments(quote.attachments);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/quotes" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回收到的报价
        </Link>
        <Link
          href={`/dashboard/rfqs/${quote.rfq.id}`}
          className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700"
        >
          查看分项比价与报价比较 →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-800">报价详情</h1>
        <span className={`text-xs px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
      </div>

      {/* 询价信息 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-sm text-slate-700">询价信息</h2>
          <span className="ml-auto font-mono text-xs text-slate-400">{quote.rfq.rfqNo || `#${quote.rfq.id}`}</span>
        </div>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          {[
            ["询价标题", quote.rfq.title],
            ["询价状态", { COLLECTING: "征集中", QUOTED: "已报价", SELECTED: "已选定", CLOSED: "已关闭", EXPIRED: "已过期" }[quote.rfq.status] || quote.rfq.status],
            ["采购明细", `${quote.rfq._count.items} 项`],
            ["联系人", quote.rfq.contactName],
            ["联系电话", quote.rfq.contactPhone || "-"],
            ["交货地点", quote.rfq.deliveryLocation || "-"],
            ["期望交货", quote.rfq.deliveryDate ? new Date(quote.rfq.deliveryDate).toLocaleDateString("zh-CN") : "-"],
            ["贸易条款", quote.rfq.incoterm || "-"],
            ["截止时间", quote.rfq.expiresAt ? new Date(quote.rfq.expiresAt).toLocaleString("zh-CN") : "-"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-slate-50 pb-2">
              <dt className="text-slate-500 shrink-0">{k}</dt>
              <dd className="text-slate-800 text-right break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 供应商信息 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-sm text-slate-700">报价供应商</h2>
        </div>
        {quote.supplier ? (
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[200px]">
              <Link href={`/suppliers/${quote.supplier.slug}`} className="text-base font-semibold text-blue-600 hover:underline">
                {quote.supplier.name}
              </Link>
              <div className="text-xs text-slate-400 mt-1">
                {quote.supplier.mainBrands && `主营品牌：${quote.supplier.mainBrands}`}
                {quote.supplier.mainEquipment && ` · 主营设备：${quote.supplier.mainEquipment}`}
                {quote.supplier.mainBusiness && ` · ${quote.supplier.mainBusiness}`}
              </div>
            </div>
            <div className="text-sm text-slate-600 space-y-1 text-right">
              {quote.supplier.contactName && <div>联系人：{quote.supplier.contactName}</div>}
              <div>
                {(quote.supplier.mobile || quote.supplier.telephone) && (
                  <span className="mr-3">电话：{quote.supplier.mobile || quote.supplier.telephone}</span>
                )}
                {quote.supplier.email && <span>邮箱：{quote.supplier.email}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">外部供应商</div>
        )}
      </div>

      {/* 报价汇总 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <h2 className="font-semibold text-sm text-slate-700 mb-3">报价汇总</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">已报价项</div>
            <div className="text-lg font-bold text-slate-800 mt-1">
              {quote.quotedCount}/{quote.rfq._count.items}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">报价总额</div>
            <div className="text-lg font-bold text-slate-800 mt-1">
              {quote.totalAmount != null ? `${quote.totalAmount.toLocaleString("zh-CN")} ${quote.currency}` : "部分报价"}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">币种</div>
            <div className="text-lg font-bold text-slate-800 mt-1">{quote.currency || "CNY"}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">报价时间</div>
            <div className="text-sm font-medium text-slate-700 mt-1.5">
              {new Date(quote.createdAt).toLocaleString("zh-CN")}
            </div>
          </div>
        </div>
        {(quote.leadTime || quote.warranty || quote.remarks) && (
          <div className="mt-3 text-sm text-slate-600 space-y-1">
            {quote.leadTime && <div>整体交期：{quote.leadTime}</div>}
            {quote.warranty && <div>质保：{quote.warranty}</div>}
            {quote.remarks && <div>备注：{quote.remarks}</div>}
          </div>
        )}
        {attachments.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-slate-500 mb-1 inline-flex items-center gap-1">
              <Paperclip className="w-3 h-3" /> 报价附件
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <a
                  key={i}
                  href={a}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2.5 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  附件 {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 分项报价明细 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-sm text-slate-700">分项报价明细（{quote.items.length} 项）</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5">序号</th>
                <th className="text-left px-4 py-2.5">件号</th>
                <th className="text-left px-4 py-2.5">产品名称</th>
                <th className="text-left px-4 py-2.5">品牌 / 设备</th>
                <th className="text-center px-4 py-2.5">数量</th>
                <th className="text-right px-4 py-2.5">单价</th>
                <th className="text-left px-4 py-2.5">币种</th>
                <th className="text-left px-4 py-2.5">交期</th>
                <th className="text-left px-4 py-2.5">质量等级</th>
                <th className="text-left px-4 py-2.5">备注</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((qi) => {
                const item = qi.rfqItem;
                return (
                  <tr key={qi.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-slate-500">{item?.seq ?? "-"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {item?.partNumberStr || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800">{item?.productName || "-"}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {[item?.brandName, item?.equipmentModel].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-600">
                      {qi.quantity ?? item?.quantity ?? "-"}
                      {item?.unit ? ` ${item.unit}` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                      {qi.unitPrice != null ? qi.unitPrice.toLocaleString("zh-CN") : "未报价"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{qi.currency || "CNY"}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{qi.leadTime || "-"}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {qi.quality ? qualityMap[qi.quality] || qi.quality : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[160px] truncate" title={qi.remarks || ""}>
                      {qi.remarks || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        提示：如需对比多家供应商的逐项报价与价格排名，请进入
        <Link href={`/dashboard/rfqs/${quote.rfq.id}`} className="text-blue-600 mx-0.5">
          该询价的比价页
        </Link>
        。
      </p>
    </div>
  );
}
