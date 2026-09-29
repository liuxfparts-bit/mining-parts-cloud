export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCompanyUserIds } from "@/lib/buyer-company";
import Pagination from "@/components/Pagination";

const STATUS_OPTIONS = ["ALL", "COLLECTING", "QUOTED", "SELECTED", "CLOSED", "EXPIRED", "REJECTED"] as const;
const PAGE_SIZES = [20, 50, 100];
const statusMap: Record<string, { label: string; cls: string }> = {
  COLLECTING: { label: "征集中", cls: "bg-blue-50 text-blue-700" }, QUOTED: { label: "已报价", cls: "bg-green-50 text-green-700" },
  SELECTED: { label: "已选定", cls: "bg-green-50 text-green-700" }, CLOSED: { label: "已关闭", cls: "bg-gray-100 text-gray-600" },
  EXPIRED: { label: "已过期", cls: "bg-red-50 text-red-600" }, REJECTED: { label: "已驳回", cls: "bg-red-50 text-red-600" },
};
const summaryCards = [{ status: "ALL", label: "全部询价" }, { status: "COLLECTING", label: "征集中" }, { status: "QUOTED", label: "已收到报价" }, { status: "SELECTED", label: "已选定" }];

function contextualAction(id: number, status: string, quotes: number) {
  if (status === "COLLECTING" && quotes === 0) return { href: `/dashboard/rfqs/${id}/invite`, label: "邀请供应商" };
  if ((status === "COLLECTING" || status === "QUOTED") && quotes > 0) return { href: `/dashboard/rfqs/${id}`, label: "查看报价" };
  if (status === "SELECTED") return { href: `/dashboard/rfqs/${id}`, label: "查看结果" };
  return { href: `/dashboard/rfqs/${id}`, label: "查看详情" };
}

export default async function BuyerRfqs({ searchParams }: { searchParams: { q?: string; status?: string; page?: string; pageSize?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: String((session.user as any).email).toLowerCase() }, select: { id: true, buyerCompanyId: true } });
  if (!user) redirect("/login");

  const companyUserIds = await getCompanyUserIds(user.id);
  // Ownership is derived from the server session; no query-string identity is accepted.
  const ownershipWhere = { OR: [{ userID: { in: companyUserIds } }, { companyID: user.buyerCompanyId ?? -1 }] };
  const q = (searchParams.q || "").trim();
  const requestedStatus = searchParams.status || "ALL";
  const status = STATUS_OPTIONS.includes(requestedStatus as (typeof STATUS_OPTIONS)[number]) ? requestedStatus : "ALL";
  const parsedPageSize = parseInt(searchParams.pageSize || "20", 10);
  const pageSize = PAGE_SIZES.includes(parsedPageSize) ? parsedPageSize : 20;
  const searchWhere = q ? { OR: [{ title: { contains: q } }, { rfqNo: { contains: q } }, { items: { some: { productName: { contains: q } } } }, { items: { some: { partNumberStr: { contains: q } } } }] } : undefined;
  const where = { AND: [ownershipWhere, ...(searchWhere ? [searchWhere] : []), ...(status === "ALL" ? [] : [{ status }])] };

  const [total, all, collecting, quoted, selected] = await Promise.all([
    prisma.rFQ.count({ where }), prisma.rFQ.count({ where: ownershipWhere }),
    prisma.rFQ.count({ where: { AND: [ownershipWhere, { status: "COLLECTING" }] } }),
    prisma.rFQ.count({ where: { AND: [ownershipWhere, { status: "QUOTED" }] } }),
    prisma.rFQ.count({ where: { AND: [ownershipWhere, { status: "SELECTED" }] } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = parseInt(searchParams.page || "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const counts: Record<string, number> = { ALL: all, COLLECTING: collecting, QUOTED: quoted, SELECTED: selected };
  const rfqs = await prisma.rFQ.findMany({ where, select: { id: true, rfqNo: true, title: true, status: true, createdAt: true, expiresAt: true, _count: { select: { items: true, quotes: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });

  const makeHref = (p: number, ps: number, nextStatus = status) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    params.set("page", String(p)); params.set("pageSize", String(ps));
    return `/dashboard/rfqs?${params.toString()}`;
  };
  const hasFilters = Boolean(q) || status !== "ALL";
  const date = (value: Date | null) => value ? new Date(value).toLocaleDateString("zh-CN") : "-";

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-bold text-slate-800">我的询价</h1><p className="mt-0.5 text-sm text-slate-500">本人及同企业成员发布的询价</p></div><Link href="/rfq/create" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">发布询价（多件号 / Excel 导入）</Link></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{summaryCards.map((card) => <Link key={card.status} href={makeHref(1, pageSize, card.status)} className={`rounded-xl border p-3 shadow-sm transition ${status === card.status ? "border-blue-300 bg-blue-50" : "border-slate-200/80 bg-white hover:border-blue-200"}`}><div className="text-xs text-slate-500">{card.label}</div><div className="mt-1 text-xl font-semibold text-slate-800">{counts[card.status]}</div></Link>)}</div>
    <form method="get" className="flex flex-wrap items-center gap-2"><input name="q" defaultValue={q} placeholder="搜索询价标题 / RFQ编号 / 产品名称 / 件号" className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /><select name="status" defaultValue={status} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"><option value="ALL">全部状态</option>{STATUS_OPTIONS.slice(1).map((value) => <option key={value} value={value}>{statusMap[value].label}</option>)}</select><input type="hidden" name="pageSize" value={pageSize} /><button className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">搜索</button>{hasFilters && <Link href="/dashboard/rfqs" className="px-2 text-sm text-slate-500 hover:text-slate-700">清除筛选</Link>}</form>
    {rfqs.length === 0 ? <div className="rounded-xl border border-slate-200/80 bg-white p-12 text-center text-sm text-slate-400 shadow-sm">{!hasFilters ? "您还没有发布过询价" : q ? "没有找到符合搜索条件的询价" : "当前状态下暂无询价"}<div className="mt-2">{!hasFilters ? <Link href="/rfq/create" className="font-medium text-blue-600">发布第一条询价 →</Link> : <Link href="/dashboard/rfqs" className="font-medium text-blue-600">返回全部询价 →</Link>}</div></div> : <><div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm md:block"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2.5 text-left">RFQ编号</th><th className="px-4 py-2.5 text-left">询价标题</th><th className="px-4 py-2.5 text-center">采购项目</th><th className="px-4 py-2.5 text-center">报价供应商</th><th className="px-4 py-2.5 text-left">状态</th><th className="px-4 py-2.5 text-left">发布时间</th><th className="px-4 py-2.5 text-left">截止时间</th><th className="px-4 py-2.5 text-left">操作</th></tr></thead><tbody>{rfqs.map((r) => { const st = statusMap[r.status] || { label: r.status, cls: "bg-gray-100 text-gray-600" }; const action = contextualAction(r.id, r.status, r._count.quotes); return <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60"><td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-400">{r.rfqNo || `#${r.id}`}</td><td className="max-w-[240px] truncate px-4 py-2.5 font-medium text-slate-800">{r.title}</td><td className="px-4 py-2.5 text-center text-slate-500">{r._count.items} 项</td><td className="px-4 py-2.5 text-center text-slate-500">{r._count.quotes} 家</td><td className="px-4 py-2.5"><span className={`inline-block rounded px-2 py-0.5 text-[11px] ${st.cls}`}>{st.label}</span></td><td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-400">{date(r.createdAt)}</td><td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-400">{date(r.expiresAt)}</td><td className="px-4 py-2.5"><Link href={action.href} className="text-xs font-medium text-blue-600 hover:underline">{action.label}</Link></td></tr>; })}</tbody></table></div>
    <div className="space-y-3 md:hidden">{rfqs.map((r) => { const st = statusMap[r.status] || { label: r.status, cls: "bg-gray-100 text-gray-600" }; const action = contextualAction(r.id, r.status, r._count.quotes); return <article key={r.id} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-mono text-xs text-slate-400">{r.rfqNo || `#${r.id}`}</div><h2 className="mt-1 truncate font-medium text-slate-800">{r.title}</h2></div><span className={`shrink-0 rounded px-2 py-0.5 text-[11px] ${st.cls}`}>{st.label}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><span>采购项目：{r._count.items} 项</span><span>报价供应商：{r._count.quotes} 家</span><span>发布：{date(r.createdAt)}</span><span>截止：{date(r.expiresAt)}</span></div><Link href={action.href} className="mt-3 inline-block text-sm font-medium text-blue-600">{action.label} →</Link></article>; })}</div></>}
    <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} makeHref={makeHref} pageSizes={PAGE_SIZES} />
  </div>;
}
