export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

const PAGE_SIZES = [20, 50, 100];

const QUOTE_STATUS_CN: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "已提交 · 采购商比价中", cls: "bg-blue-50 text-blue-700" },
  ACCEPTED: { label: "已中标", cls: "bg-green-50 text-green-700" },
  REJECTED: { label: "未中标", cls: "bg-gray-100 text-gray-500" },
  WITHDRAWN: { label: "已撤回", cls: "bg-red-50 text-red-600" },
};

export default async function SupplierQuotes({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string; q?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((session.user as any).email).toLowerCase() },
    select: { supplierId: true },
  });
  if (!user?.supplierId) redirect("/supplier");

  const q = String(searchParams.q || "").trim();
  const pageSize = PAGE_SIZES.includes(parseInt(searchParams.pageSize || ""))
    ? parseInt(searchParams.pageSize || "20")
    : 20;

  // ===== 数据库级 WHERE：当前供应商 + 可选关键词（询价标题 / RFQ编号 / 件号 / 配件名）=====
  const where: Record<string, unknown> = { supplierId: user.supplierId };
  if (q) {
    where.rfq = {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { rfqNo: { contains: q, mode: "insensitive" } },
        { partNumberStr: { contains: q, mode: "insensitive" } },
        { productName: { contains: q, mode: "insensitive" } },
        { items: { some: { partNumberStr: { contains: q, mode: "insensitive" } } } },
        { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
      ],
    };
  }

  // ===== 数据库级统计（总数量 = 非当前页数量）=====
  const total = await prisma.quote.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requested = parseInt(searchParams.page || "1");
  const page = isNaN(requested) || requested < 1 ? 1 : Math.min(requested, totalPages);
  const skip = (page - 1) * pageSize;

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      rfq: {
        select: {
          id: true,
          title: true,
          rfqNo: true,
          contactName: true,
          expiresAt: true,
          _count: { select: { items: true } },
        },
      },
      items: { include: { rfqItem: true }, orderBy: { id: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
  });

  const href = (p: number, ps: number) => {
    const sp = new URLSearchParams({ page: String(p), pageSize: String(ps) });
    if (q) sp.set("q", q);
    return `/supplier/quotes?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">已投报价（{total}）</h1>
        <p className="text-sm text-gray-500 mt-1">您提交给采购商的全部报价记录</p>
      </div>

      {/* 搜索（数据库查询） */}
      <form method="GET" action="/supplier/quotes" className="flex flex-col sm:flex-row gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="搜索询价标题 / RFQ编号 / 件号 / 配件名称"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700">搜索</button>
        {q && (
          <Link
            href="/supplier/quotes"
            className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 text-center"
          >
            重置
          </Link>
        )}
      </form>

      {quotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center text-gray-500">
          {q ? "没有找到符合条件的报价记录" : "暂无报价记录，去询价大厅接单报价吧"}
          {q && (
            <div className="mt-3">
              <Link href="/supplier/quotes" className="text-blue-600 text-sm">重置搜索</Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5">询价</th>
                <th className="text-left px-4 py-2.5">报价项数</th>
                <th className="text-left px-4 py-2.5">报价金额</th>
                <th className="text-left px-4 py-2.5">币种</th>
                <th className="text-left px-4 py-2.5">交期</th>
                <th className="text-left px-4 py-2.5">报价时间</th>
                <th className="text-left px-4 py-2.5">状态</th>
                <th className="text-left px-4 py-2.5">操作</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((qo) => {
                const st = QUOTE_STATUS_CN[qo.status] || { label: qo.status, cls: "bg-gray-100 text-gray-500" };
                const totalItems = qo.rfq._count.items;
                const leadTimes = Array.from(
                  new Set(qo.items.map((i) => i.leadTime).filter((v): v is string => !!v)),
                ).join(" / ");
                const amount =
                  qo.totalAmount != null
                    ? qo.totalAmount.toLocaleString()
                    : qo.items.length > 0
                      ? "部分报价"
                      : qo.unitPrice != null
                        ? qo.unitPrice.toLocaleString()
                        : "—";
                const currency =
                  qo.totalAmount != null
                    ? qo.items[0]?.currency || qo.currency
                    : qo.items[0]?.currency || qo.currency;
                return (
                  <tr key={qo.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 max-w-[220px] truncate">{qo.rfq.title}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {qo.rfq.rfqNo || `#${qo.rfq.id}`} · 采购方 {qo.rfq.contactName || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {qo.quotedCount}/{totalItems} 项
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800 whitespace-nowrap">
                      {amount}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{currency}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px]">{leadTimes || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(qo.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11px] px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/supplier/quotes/${qo.id}`}
                        className="text-blue-600 text-xs whitespace-nowrap hover:text-blue-700"
                      >
                        查看报价 →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 数据库级分页 */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200/80 shadow-sm p-3 text-sm">
          <span className="text-gray-500">
            共 {total} 条 · 第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={href(Math.max(1, page - 1), pageSize)}
              className={`px-3 py-1.5 border rounded ${page <= 1 ? "opacity-40 pointer-events-none" : "hover:bg-gray-50"}`}
            >
              上一页
            </Link>
            <span className="px-3 py-1.5 bg-blue-600 text-white rounded">{page}</span>
            <Link
              href={href(Math.min(totalPages, page + 1), pageSize)}
              className={`px-3 py-1.5 border rounded ${page >= totalPages ? "opacity-40 pointer-events-none" : "hover:bg-gray-50"}`}
            >
              下一页
            </Link>
            <select
              defaultValue={pageSize}
              onChange={(e) => {
                const v = e.target.value;
                const sp = new URLSearchParams({ page: "1", pageSize: v });
                if (q) sp.set("q", q);
                window.location.href = `/supplier/quotes?${sp.toString()}`;
              }}
              className="border rounded px-2 py-1.5 text-sm"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} 条/页
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
