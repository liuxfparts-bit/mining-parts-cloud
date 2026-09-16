export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCompanyUserIds } from "@/lib/buyer-company";

const statusMap: Record<string, { label: string; cls: string }> = {
  COLLECTING: { label: "征集中", cls: "bg-blue-50 text-blue-700" },
  QUOTED: { label: "已报价", cls: "bg-green-50 text-green-700" },
  SELECTED: { label: "已选定", cls: "bg-green-50 text-green-700" },
  CLOSED: { label: "已关闭", cls: "bg-gray-100 text-gray-600" },
  EXPIRED: { label: "已过期", cls: "bg-red-50 text-red-600" },
  REJECTED: { label: "已驳回", cls: "bg-red-50 text-red-600" },
};

const PAGE_SIZES = [20, 50, 100];

export default async function BuyerRfqs({ searchParams }: { searchParams: { page?: string; pageSize?: string } }) {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, buyerCompanyId: true },
  });
  if (!user) redirect("/login");

  // 企业共享归属查询：本人发布 + 同企业主/子账号发布的 RFQ（以 session 为准，不信任任何前端参数）
  const companyUserIds = await getCompanyUserIds(user.id);
  const where: any = {
    OR: [{ userID: { in: companyUserIds } }, { companyID: user.buyerCompanyId ?? -1 }],
  };

  const pageSize = PAGE_SIZES.includes(parseInt(searchParams.pageSize || ""))
    ? parseInt(searchParams.pageSize || "20")
    : 20;
  const page = Math.max(1, parseInt(searchParams.page || "1") || 1);

  const total = await prisma.rFQ.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 数据库级分页：只取当前页（列表只取聚合计数，采购明细统一在 RFQ 详情页展示）
  const rfqs = await prisma.rFQ.findMany({
    where,
    select: {
      id: true,
      rfqNo: true,
      title: true,
      status: true,
      createdAt: true,
      _count: { select: { items: true, quotes: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-bold">我的询价（{total}）</h1>
        <Link href="/rfq/create" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">
          发布询价（多件号 / Excel 导入）
        </Link>
      </div>

      {rfqs.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">
          <p className="mb-3">您还没有发布过询价</p>
          <Link href="/rfq/create" className="text-blue-600 text-sm font-medium">
            立即发布第一条采购询价 →
          </Link>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 text-left">RFQ编号</th>
                  <th className="p-3 text-left">询价标题</th>
                  <th className="p-3 text-left">采购项目数</th>
                  <th className="p-3 text-left">报价数</th>
                  <th className="p-3 text-left">状态</th>
                  <th className="p-3 text-left">发布时间</th>
                  <th className="p-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((r) => {
                  const st = statusMap[r.status] || { label: r.status, cls: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                        {r.rfqNo || `#${r.id}`}
                      </td>
                      <td className="p-3 font-medium">{r.title}</td>
                      <td className="p-3 text-center">{r._count.items} 项</td>
                      <td className="p-3 text-center">{r._count.quotes} 家</td>
                      <td className="p-3">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="p-3 text-gray-500 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/dashboard/rfqs/${r.id}`}
                          className="text-blue-600 hover:underline text-sm whitespace-nowrap">
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

      {/* 数据库级分页 */}
      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-gray-500">
            共 {total} 条 · 第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            {PAGE_SIZES.map((ps) => (
              <Link
                key={ps}
                href={`/dashboard/rfqs?page=1&pageSize=${ps}`}
                className={`px-2 py-1 rounded border text-xs ${
                  ps === pageSize ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-slate-200"
                }`}>
                {ps}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={`/dashboard/rfqs?page=${page - 1}&pageSize=${pageSize}`}
                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-gray-700">
                上一页
              </Link>
            )}
            <span className="px-2">{page}</span>
            {page < totalPages && (
              <Link
                href={`/dashboard/rfqs?page=${page + 1}&pageSize=${pageSize}`}
                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-gray-700">
                下一页
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
