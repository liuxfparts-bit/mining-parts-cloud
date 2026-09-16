export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCompanyUserIds } from "@/lib/buyer-company";

const PAGE_SIZES = [10, 20, 50];

const statusMap: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "待处理", cls: "bg-amber-50 text-amber-700" },
  ACCEPTED: { label: "已接受", cls: "bg-green-50 text-green-700" },
  REJECTED: { label: "已拒绝", cls: "bg-red-50 text-red-600" },
  WITHDRAWN: { label: "已撤回", cls: "bg-gray-100 text-gray-500" },
};

export default async function BuyerQuotes({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string; pageSize?: string };
}) {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, buyerCompanyId: true },
  });
  if (!user) redirect("/login");

  // 企业共享：本人 + 同企业主/子账号发布的 RFQ 收到的报价
  const companyUserIds = await getCompanyUserIds(user.id);
  const companyId = user.buyerCompanyId ?? -1;
  const rfqs = await prisma.rFQ.findMany({
    where: { OR: [{ userID: { in: companyUserIds } }, { companyID: companyId }] },
    select: { id: true },
  });
  const rfqIds = rfqs.map((r) => r.id);

  const q = (searchParams.q || "").trim();
  const status = searchParams.status || "ALL";
  const pageSize = PAGE_SIZES.includes(parseInt(searchParams.pageSize || "10"))
    ? parseInt(searchParams.pageSize || "10")
    : 10;
  const page = Math.max(1, parseInt(searchParams.page || "1") || 1);

  const where: any = {
    rfqId: { in: rfqIds },
    ...(status !== "ALL" && { status }),
    ...(q && {
      OR: [
        { rfq: { title: { contains: q } } },
        { rfq: { rfqNo: { contains: q } } },
        { supplier: { name: { contains: q } } },
      ],
    }),
  };

  // 动态统计：数据库总数量（非当前页数量）
  const total = await prisma.quote.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const quotes = await prisma.quote.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true, slug: true } },
      rfq: { select: { id: true, title: true, rfqNo: true, status: true, expiresAt: true, _count: { select: { items: true } } } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const statusOptions = ["ALL", "PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">收到的报价</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            共 <span className="font-semibold text-slate-700">{total}</span> 份报价（来自您与同企业成员发布的询价）
          </p>
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索询价标题 / RFQ编号 / 供应商"
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <select
            name="status"
            defaultValue={status}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "全部状态" : statusMap[s]?.label || s}
              </option>
            ))}
          </select>
          <button className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm hover:bg-blue-700">搜索</button>
          <Link href="/dashboard/quotes" className="text-sm text-slate-500 px-2 hover:text-slate-700">
            重置
          </Link>
        </form>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center text-sm text-slate-400">
          暂无收到的报价
          <div className="mt-2">
            <Link href="/rfq/create" className="text-blue-600 font-medium">
              发布询价，等待供应商报价 →
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 桌面表格 */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2.5">询价</th>
                    <th className="text-left px-4 py-2.5">供应商</th>
                    <th className="text-center px-4 py-2.5">报价项</th>
                    <th className="text-left px-4 py-2.5">币种</th>
                    <th className="text-left px-4 py-2.5">状态</th>
                    <th className="text-left px-4 py-2.5">报价时间</th>
                    <th className="text-left px-4 py-2.5">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((qt) => {
                    const st = statusMap[qt.status] || { label: qt.status, cls: "bg-gray-100 text-gray-600" };
                    const itemTotal = qt.rfq?._count?.items || 0;
                    return (
                      <tr key={qt.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 max-w-[220px] truncate">{qt.rfq?.title}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{qt.rfq?.rfqNo || `#${qt.rfqId}`}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/suppliers/${qt.supplier?.slug}`} className="text-blue-600 hover:underline">
                            {qt.supplier?.name || "外部供应商"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {qt._count.items}/{itemTotal}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{qt.currency || "CNY"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(qt.createdAt).toLocaleString("zh-CN")}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/quotes/${qt.id}`}
                            className="text-blue-600 hover:underline text-xs font-medium"
                          >
                            查看报价
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 手机卡片 */}
          <div className="md:hidden space-y-3">
            {quotes.map((qt) => {
              const st = statusMap[qt.status] || { label: qt.status, cls: "bg-gray-100 text-gray-600" };
              return (
                <div key={qt.id} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 text-sm truncate">{qt.rfq?.title}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {qt.rfq?.rfqNo || `#${qt.rfqId}`}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    供应商：<span className="font-medium">{qt.supplier?.name || "外部供应商"}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    报价项：{qt._count.items}/{qt.rfq?._count?.items || 0} · 币种：{qt.currency || "CNY"}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    报价时间：{new Date(qt.createdAt).toLocaleString("zh-CN")}
                  </div>
                  <div className="mt-3">
                    <Link
                      href={`/dashboard/quotes/${qt.id}`}
                      className="inline-block w-full text-center bg-blue-600 text-white rounded-lg py-2 text-sm font-medium"
                    >
                      查看报价
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <span>
              第 {page} / {totalPages} 页 · 共 {total} 条
            </span>
            <span className="hidden sm:flex items-center gap-1">
              | 每页
              {PAGE_SIZES.map((ps) => (
                <a
                  key={ps}
                  href={`/dashboard/quotes?q=${encodeURIComponent(q)}&status=${status}&pageSize=${ps}&page=1`}
                  className={`px-1.5 rounded ${pageSize === ps ? "text-blue-600 font-semibold" : "text-slate-400 hover:text-slate-600"}`}
                >
                  {ps}
                </a>
              ))}
            </span>
          </div>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/dashboard/quotes?q=${encodeURIComponent(q)}&status=${status}&pageSize=${pageSize}&page=${page - 1}`}
                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-700"
              >
                上一页
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/dashboard/quotes?q=${encodeURIComponent(q)}&status=${status}&pageSize=${pageSize}&page=${page + 1}`}
                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-700"
              >
                下一页
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
