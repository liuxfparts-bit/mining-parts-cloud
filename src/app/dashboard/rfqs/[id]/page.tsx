export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { closeMyRfq, deleteMyRfq } from "../actions";
import { RfqDangerActions } from "./RfqDangerActions";
import InvitationSection from "./InvitationSection";
import { buildItemRanks, quotedSupplierCount, type ComparisonItem, type ComparisonQuote } from "@/lib/rfq-comparison";

const statusMap: Record<string, { label: string; cls: string }> = {
  COLLECTING: { label: "征集中", cls: "bg-blue-50 text-blue-700" }, QUOTED: { label: "已报价", cls: "bg-green-50 text-green-700" }, SELECTED: { label: "已选定", cls: "bg-green-50 text-green-700" }, CLOSED: { label: "已关闭", cls: "bg-gray-100 text-gray-600" }, EXPIRED: { label: "已过期", cls: "bg-red-50 text-red-600" }, REJECTED: { label: "已驳回", cls: "bg-red-50 text-red-600" },
};
const PAGE_SIZES = [20, 50, 100];
const date = (value: Date | null | undefined) => value ? new Date(value).toLocaleDateString("zh-CN") : "—";

export default async function BuyerRfqDetail({ params, searchParams }: { params: { id: string }; searchParams: { page?: string; pageSize?: string; invPage?: string; invPageSize?: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: String((session.user as any).email).toLowerCase() }, select: { id: true, buyerCompanyId: true } });
  if (!user) redirect("/login");

  // Server-side buyer and company scope remains authoritative.
  const rfq = await prisma.rFQ.findUnique({ where: { id }, select: { id: true, title: true, rfqNo: true, status: true, createdAt: true, userID: true, companyID: true, contactName: true, contactPhone: true, deliveryLocation: true, deliveryDate: true, incoterm: true, expiresAt: true, _count: { select: { items: true, invitations: true } } } });
  if (!rfq) notFound();
  const sameCompany = rfq.companyID != null && user.buyerCompanyId != null && rfq.companyID === user.buyerCompanyId;
  if (rfq.userID !== user.id && !sameCompany) notFound();

  const totalItems = rfq._count.items;
  const pageSize = PAGE_SIZES.includes(parseInt(searchParams.pageSize || "")) ? parseInt(searchParams.pageSize || "20") : 20;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requestedPage = parseInt(searchParams.page || "1");
  const page = isNaN(requestedPage) || requestedPage < 1 ? 1 : Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;
  // RFQ items, rather than QuoteItems, remain the database pagination unit.
  const items = (await prisma.rFQItem.findMany({ where: { rfqId: id }, include: { partNumber: true }, orderBy: { seq: "asc" }, skip, take: pageSize })) as ComparisonItem[];
  const quotes = (await prisma.quote.findMany({ where: { rfqId: id }, include: { supplier: true, items: true }, orderBy: { createdAt: "asc" } })) as ComparisonQuote[];
  const quotedSuppliers = quotedSupplierCount(quotes);
  const itemRanks = buildItemRanks(items, quotes);
  const status = statusMap[rfq.status] || { label: rfq.status, cls: "bg-gray-100 text-gray-600" };
  const canInvite = ["COLLECTING", "QUOTED", "SELECTED"].includes(rfq.status);
  const pageHref = (nextPage: number, nextSize: number) => {
    const query = new URLSearchParams({ page: String(nextPage), pageSize: String(nextSize) });
    if (searchParams.invPage) query.set("invPage", searchParams.invPage);
    if (searchParams.invPageSize) query.set("invPageSize", searchParams.invPageSize);
    return `/dashboard/rfqs/${id}?${query.toString()}`;
  };

  function RankBadge({ rank }: { rank: number }) { return <span className="ml-1" title={`价格第 ${rank} 名`}>{rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : <span className="text-[10px] text-gray-400">#{rank}</span>}</span>; }
  function Pagination() {
    if (totalItems <= pageSize) return null;
    const start = Math.max(1, Math.min(totalPages - 4, page - 2));
    const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
    return <div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><div className="flex items-center gap-1"><span className="mr-1 text-xs text-gray-400">每页</span>{PAGE_SIZES.map((size) => <Link key={size} href={pageHref(1, size)} className={`h-8 rounded-md border px-2 text-xs leading-8 ${pageSize === size ? "border-blue-600 text-blue-600" : "border-[#dce2e6] bg-white"}`}>{size} 条</Link>)}</div><div className="flex items-center gap-1">{page > 1 && <Link href={pageHref(page - 1, pageSize)} className="rounded border px-2.5 py-1 hover:bg-gray-50">上一页</Link>}{pages.map((p) => <Link key={p} href={pageHref(p, pageSize)} className={`rounded border px-2.5 py-1 ${p === page ? "border-blue-600 bg-blue-600 text-white" : "hover:bg-gray-50"}`}>{p}</Link>)}{page < totalPages && <Link href={pageHref(page + 1, pageSize)} className="rounded border px-2.5 py-1 hover:bg-gray-50">下一页</Link>}</div><span className="text-xs text-gray-400">第 {page} / {totalPages} 页 · 共 {totalItems} 个采购项目</span></div>;
  }

  return <div className="mx-auto max-w-7xl p-4 sm:p-6">
    <header className="mb-5 rounded-xl border bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/dashboard/rfqs" className="text-sm text-gray-500 hover:text-blue-600">← 返回我的询价</Link><div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-gray-900">{rfq.title}</h1><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}>{status.label}</span></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span className="font-mono">询价编号：{rfq.rfqNo || "—"}</span><span>创建于 {date(rfq.createdAt)}</span>{rfq.expiresAt && <span>截止于 {date(rfq.expiresAt)}</span>}</div></div><div className="flex flex-wrap items-center gap-2">{canInvite && <Link href={`/dashboard/rfqs/${rfq.id}/invite`} className="rounded border border-blue-600 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50">邀请供应商报价</Link>}{quotes.length > 0 && <a href={`/api/rfq/${rfq.id}/export`} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">导出报价 (Excel)</a>}</div></div></header>

    <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">{[{ label: "采购项目", value: `${totalItems} 项` }, { label: "报价供应商", value: `${quotedSuppliers} 家` }, { label: "邀请供应商", value: `${rfq._count.invitations} 家` }, { label: "当前状态", value: status.label }].map((card) => <div key={card.label} className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-400">{card.label}</p><p className="mt-1 text-lg font-semibold text-gray-900">{card.value}</p></div>)}</section>

    <section className="mb-5 rounded-xl border bg-white p-5"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-bold">采购需求 / 采购明细</h2><p className="mt-1 text-xs text-gray-400">按询价原始顺序展示 · 共 {totalItems} 项</p></div>{totalItems > 0 && <span className="text-xs text-gray-400">显示第 {skip + 1}–{Math.min(skip + pageSize, totalItems)} 项</span>}</div>{items.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-400">该询价暂未添加采购项目。</div> : <><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs text-gray-400"><th className="py-2 pr-3">Item</th><th className="px-3 py-2">件号</th><th className="px-3 py-2">产品名称</th><th className="px-3 py-2">品牌 / 设备</th><th className="px-3 py-2">数量</th><th className="px-3 py-2">单位</th><th className="px-3 py-2">备注</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-gray-100 align-top"><td className="py-3 pr-3"><span className="whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-xs font-bold">Item {item.seq}</span></td><td className="px-3 py-3 font-mono text-xs">{item.partNumberStr || item.partNumber?.number || "—"}</td><td className="px-3 py-3">{item.productName || "—"}</td><td className="px-3 py-3 text-xs">{[item.brandName, item.equipmentModel].filter(Boolean).join(" / ") || "—"}</td><td className="px-3 py-3">{item.quantity}</td><td className="px-3 py-3">{item.unit || "—"}</td><td className="max-w-xs px-3 py-3 text-xs text-gray-600">{item.description || "—"}</td></tr>)}</tbody></table></div><Pagination /></>}</section>

    <section className="mb-5 rounded-xl border bg-white p-5"><h2 className="font-bold">报价进度</h2><p className="mt-1 text-xs text-gray-400">已报价供应商 {quotedSuppliers} 家；总额仅在完整且同币种报价时显示。</p>{quotes.length === 0 ? <div className="mt-4 rounded-lg border border-dashed p-8 text-center"><p className="text-sm text-gray-400">暂无供应商报价</p>{canInvite && <Link href={`/dashboard/rfqs/${rfq.id}/invite`} className="mt-3 inline-block text-sm text-blue-600 hover:underline">邀请供应商报价</Link>}</div> : <div className="mt-4 space-y-2">{quotes.map((quote) => { const legacyPrice = quote.items.length === 0 && quote.unitPrice != null ? quote.unitPrice : null; const complete = totalItems > 0 && quote.quotedCount >= totalItems; return <div key={quote.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm"><div><p className="font-medium">{quote.supplier.shortName || quote.supplier.name || "供应商"}</p><p className={`mt-1 text-xs ${complete ? "text-green-700" : "text-amber-600"}`}>{legacyPrice != null ? "历史报价" : `${complete ? "完整报价" : "部分报价"}：${quote.quotedCount}/${totalItems} 项`}</p></div><div className="text-right text-xs text-gray-600">{legacyPrice != null ? <span>历史总价：{quote.currency} {legacyPrice.toLocaleString()}</span> : quote.totalAmount != null ? <span className="font-semibold text-green-700">总额 {quote.items[0]?.currency || "CNY"} {quote.totalAmount.toLocaleString()}</span> : <span>总额暂不可用</span>}</div></div>; })}</div>}</section>

    <section className="mb-5 rounded-xl border bg-white p-5"><h2 className="font-bold">分项比价</h2><p className="mt-1 text-xs text-gray-400">价格排名按同一明细、同一币种从低到高；不同币种不互相比较。最低价仅为价格第 1 名，不代表“最佳供应商”。</p>{quotes.length === 0 ? <div className="mt-4 rounded-lg border border-dashed p-8 text-center text-sm text-gray-400">暂无报价，暂无法进行分项比价。</div> : items.length === 0 ? <div className="mt-4 rounded-lg border border-dashed p-8 text-center text-sm text-gray-400">该询价暂无采购项目，暂无法进行分项比价。</div> : <><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-left text-xs text-gray-400"><th className="py-2 pr-2">Item</th><th className="px-2 py-2">件号</th><th className="px-2 py-2">配件名称</th><th className="px-2 py-2">数量</th>{quotes.map((quote) => <th key={quote.id} className="whitespace-nowrap px-2 py-2">{quote.supplier.shortName || quote.supplier.name}</th>)}</tr></thead><tbody>{items.map((item) => { const row = itemRanks[item.id] || {}; return <tr key={item.id} className="border-b border-gray-100 align-top"><td className="py-2 pr-2"><span className="whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-xs font-bold">Item {item.seq}</span></td><td className="px-2 py-2 font-mono text-xs">{item.partNumberStr || item.partNumber?.number || "—"}</td><td className="px-2 py-2 text-xs">{item.productName || "—"}</td><td className="whitespace-nowrap px-2 py-2 text-xs">{item.quantity} {item.unit}</td>{quotes.map((quote) => { const cell = row[quote.id]; return <td key={quote.id} className="whitespace-nowrap px-2 py-2">{cell ? <><span className="font-mono text-xs font-semibold">{cell.currency} {cell.price.toLocaleString()}</span>{cell.rank != null && <RankBadge rank={cell.rank} />}</> : <span className="text-xs text-gray-400">—</span>}</td>; })}</tr>; })}</tbody></table></div><Pagination /></>}</section>

    <section className="mb-5 rounded-xl border bg-white p-5"><h2 className="font-bold">询价信息</h2><div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{[{ label: "联系人", value: rfq.contactName }, { label: "联系电话", value: rfq.contactPhone }, { label: "交货地点", value: rfq.deliveryLocation }, { label: "期望交期", value: date(rfq.deliveryDate) }, { label: "贸易条款", value: rfq.incoterm }, { label: "创建日期", value: date(rfq.createdAt) }, { label: "截止日期", value: date(rfq.expiresAt) }].map((field) => <div key={field.label}><p className="text-xs text-gray-400">{field.label}</p><p className="mt-1 text-gray-800">{field.value || "—"}</p></div>)}</div></section>
    <InvitationSection rfqId={rfq.id} page={parseInt(searchParams.invPage || "1") || 1} pageSize={parseInt(searchParams.invPageSize || "10") || 10} canInvite={canInvite} />
    <section className="mt-5 rounded-xl border border-red-100 bg-red-50/40 p-5"><h2 className="font-bold text-gray-900">询价管理</h2><p className="mt-1 text-xs text-gray-500">关闭或删除询价会影响后续采购流程，请确认当前处理状态。</p><div className="mt-4"><RfqDangerActions rfqId={rfq.id} canClose={canInvite} canDelete={rfq.userID === user.id} hasQuotes={quotes.length > 0} closeAction={closeMyRfq.bind(null, rfq.id)} deleteAction={deleteMyRfq.bind(null, rfq.id)} /></div></section>
  </div>;
}
