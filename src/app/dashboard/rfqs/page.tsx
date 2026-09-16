export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCompanyUserIds } from "@/lib/buyer-company";
import Pagination from "@/components/Pagination";

const statusMap: Record<string, { label: string; cls: string }> = {
  COLLECTING: { label: "征集中", cls: "bg-blue-50 text-blue-700" },
  QUOTED: { label: "已报价", cls: "bg-green-50 text-green-700" },
  SELECTED: { label: "已选定", cls: "bg-green-50 text-green-700" },
  CLOSED: { label: "已关闭", cls: "bg-gray-100 text-gray-600" },
  EXPIRED: { label: "已过期", cls: "bg-red-50 text-red-600" },
  REJECTED: { label: "已驳回", cls: "bg-red-50 text-red-600" },
};

export default async function BuyerRfqs({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; pageSize?: string };
}) {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, buyerCompanyId: true },
  });
  if (!user) redirect("/login");

  // 企业共享归属查询：本人发布 + 同企业主/子账号发布（以 session 为准，不信任前端参数）
  const companyUserIds = await getCompanyUserIds(user.id);
  const q = (searchParams.q || "").trim();
  const pageSize = [10, 20, 50].includes(parseInt(searchParams.pageSize || "10"))
    ? parseInt(searchParams.pageSize || "10")
    : 10;
  const page = Math.max(1, parseInt(searchParams.page || "1") || 1);

  // 搜索：标题 / RFQ编号 / 采购明细中的产品名称与件号（数据库级，不加载全量）
  const searchWhere: any = q
    ? {
        OR: [
          { title: { contains: q } },
          { rfqNo: { contains: q } },
          { items: { some: { productName: { contains: q } } } },
          { items: { some: { partNumberStr: { contains: q } } } },
        ],
      }
    : null;

  const where: any = searchWhere
    ? {
        AND: [{ OR: [{ userID: { in: companyUserIds } }, { companyID: user.buyerCompanyId ?? -1 }] }, searchWhere],
      }
    : { OR: [{ userID: { in: companyUserIds } }, { companyID: user.buyerCompanyId ?? -1 }] };

  const total = await prisma.rFQ.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rfqs = await prisma.rFQ.findMany({
    where,
    select: {
      id: true,
      rfqNo: true,
      title: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      _count: { select: { items: true, quotes: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const makeHref = (p: number, ps: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    sp.set("page", String(p));
    sp.set("pageSize", String(ps));
    return `/dashboard/rfqs?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">我的询价</h1>
          <p className="text-sm text-slate-500 mt-0.5">共 {total} 条询价（本人及同企业成员发布）</p>
        </div>
        <Link
          href="/rfq/create"
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          发布询价（多件号 / Excel 导入）
        </Link>
      </div>

      {/* 搜索 */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="搜索询价标题 / RFQ编号 / 产品名称 / 件号"
          className="flex-1 min-w-[240px] max-w-md border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm hover:bg-blue-700">搜索</button>
        <Link href="/dashboard/rfqs" className="text-sm text-slate-500 px-2 hover:text-slate-700">
          重置
        </Link>
      </form>

      {rfqs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center text-sm text-slate-400">
          {q ? "没有找到符合条件的询价" : "您还没有发布过询价"}
          <div className="mt-2">
            <Link href="/rfq/create" className="text-blue-600 font-medium">
              发布第一条询价 →
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">RFQ编号</th>
                  <th className="text-left px-4 py-2.5">询价标题</th>
                  <th className="text-center px-4 py-2.5">采购项目</th>
                  <th className="text-center px-4 py-2.5">报价数</th>
                  <th className="text-left px-4 py-2.5">状态</th>
                  <th className="text-left px-4 py-2.5">发布时间</th>
                  <th className="text-left px-4 py-2.5">截止时间</th>
                  <th className="text-left px-4 py-2.5">操作</th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((r) => {
                  const st = statusMap[r.status] || { label: r.status, cls: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400 whitespace-nowrap">
                        {r.rfqNo || `#${r.id}`}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[200px] truncate">{r.title}</td>
                      <td className="px-4 py-2.5 text-center text-slate-500">{r._count.items} 项</td>
                      <td className="px-4 py-2.5 text-center text-slate-500">{r._count.quotes} 家</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block text-[11px] px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                        {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString("zh-CN") : "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link href={`/dashboard/rfqs/${r.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                          查看详情 / 管理
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} makeHref={makeHref} />
    </div>
  );
}
