export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BUYER_VERIFY_STATUS_CN, BUYER_LEVEL_CN, BUYER_LEVEL_BADGE } from "@/lib/buyer-company";

export default async function AdminBuyerCompaniesPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const s = await auth();
  if (!s || (s.user as any)?.role !== "ADMIN") redirect("/admin");

  const statusFilter = searchParams.status || "ALL";
  const pageSize = 20;
  const page = Math.max(1, parseInt(searchParams.page || "1") || 1);

  const where: any = {};
  if (statusFilter !== "ALL") where.verifiedStatus = statusFilter;

  const total = await prisma.buyerCompany.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const companies = await prisma.buyerCompany.findMany({
    where,
    include: {
      users: { select: { id: true, name: true, email: true, isOwner: true }, take: 20 },
      _count: { select: { users: true } },
    },
    orderBy: [{ verifiedStatus: "asc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const tabs = [
    ["ALL", "全部"],
    ["PENDING", "待审核"],
    ["VERIFIED", "已认证"],
    ["REJECTED", "已驳回"],
    ["UNSUBMITTED", "未提交"],
  ];

  const statusCls: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    VERIFIED: "bg-green-50 text-green-700",
    REJECTED: "bg-red-50 text-red-600",
    UNSUBMITTED: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">采购商认证审核</h1>
          <p className="text-sm text-slate-500 mt-0.5">共 {total} 家企业申请</p>
        </div>
      </div>

      {/* 状态筛选 */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(([v, label]) => (
          <a
            key={v}
            href={`/admin/buyer-companies?status=${v}`}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              statusFilter === v
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {companies.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">暂无企业认证申请</div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 border-b text-xs text-slate-500">
                <tr>
                  <th className="text-left p-3">企业名称</th>
                  <th className="text-left p-3">统一信用代码</th>
                  <th className="text-left p-3">联系人</th>
                  <th className="text-left p-3">地区</th>
                  <th className="text-left p-3">成员</th>
                  <th className="text-left p-3">企业等级</th>
                  <th className="text-left p-3">状态</th>
                  <th className="text-left p-3">提交时间</th>
                  <th className="text-left p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{c.companyName}</td>
                    <td className="p-3 font-mono text-xs text-slate-500">{c.unifiedCode || "-"}</td>
                    <td className="p-3">{c.contactName || "-"}</td>
                    <td className="p-3">{c.region || "-"}</td>
                    <td className="p-3">{c._count.users} 人</td>
                    <td className="p-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${BUYER_LEVEL_BADGE[c.level]}`}>
                        {BUYER_LEVEL_CN[c.level]}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded ${statusCls[c.verifiedStatus]}`}>
                        {BUYER_VERIFY_STATUS_CN[c.verifiedStatus]}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      {c.submittedAt ? new Date(c.submittedAt).toLocaleDateString("zh-CN") : "-"}
                    </td>
                    <td className="p-3">
                      <a href={`/admin/buyer-companies/${c.id}`} className="text-blue-600 hover:underline text-xs">
                        查看 / 审核
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            第 {page} / {totalPages} 页 · 共 {total} 条
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/admin/buyer-companies?status=${statusFilter}&page=${page - 1}`}
                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-700"
              >
                上一页
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/admin/buyer-companies?status=${statusFilter}&page=${page + 1}`}
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
