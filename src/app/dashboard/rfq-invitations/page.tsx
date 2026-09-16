export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCompanyUserIds } from "@/lib/buyer-company";
import Pagination from "@/components/Pagination";

const statusMap: Record<string, { label: string; cls: string }> = {
  PENDING_VIEW: { label: "待查看", cls: "bg-blue-50 text-blue-700" },
  VIEWED: { label: "已查看", cls: "bg-indigo-50 text-indigo-700" },
  ACCEPTED: { label: "已接受", cls: "bg-green-50 text-green-700" },
  QUOTED: { label: "已报价", cls: "bg-green-50 text-green-700" },
  REJECTED: { label: "已拒绝", cls: "bg-red-50 text-red-600" },
  EXPIRED: { label: "已过期", cls: "bg-gray-100 text-gray-500" },
};

export default async function BuyerRfqInvitations({
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

  // 归属：本企业 RFQ 发出的邀请（本人 + 同企业成员）
  const companyUserIds = await getCompanyUserIds(user.id);
  const rfqs = await prisma.rFQ.findMany({
    where: { OR: [{ userID: { in: companyUserIds } }, { companyID: user.buyerCompanyId ?? -1 }] },
    select: { id: true },
  });
  const rfqIds = rfqs.map((r) => r.id);

  const q = (searchParams.q || "").trim();
  const status = searchParams.status || "ALL";
  const pageSize = [10, 20, 50].includes(parseInt(searchParams.pageSize || "10"))
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
        { externalCompanyName: { contains: q } },
      ],
    }),
  };

  const total = await prisma.rFQInvitation.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const invitations = await prisma.rFQInvitation.findMany({
    where,
    include: {
      rfq: { select: { id: true, title: true, rfqNo: true, status: true } },
      supplier: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { invitedAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const makeHref = (p: number, ps: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status !== "ALL") sp.set("status", status);
    sp.set("page", String(p));
    sp.set("pageSize", String(ps));
    return `/dashboard/rfq-invitations?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">询价邀请</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            共 {total} 条邀请（您与同企业成员发出的供应商邀请）
          </p>
        </div>
        <Link
          href="/dashboard/rfqs"
          className="text-sm text-blue-600 hover:underline"
        >
          前往询价详情发起新邀请 →
        </Link>
      </div>

      {/* 搜索 + 状态筛选 */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="搜索询价标题 / RFQ编号 / 供应商"
          className="flex-1 min-w-[220px] max-w-md border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <select name="status" defaultValue={status} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white">
          <option value="ALL">全部状态</option>
          {Object.entries(statusMap).map(([v, s]) => (
            <option key={v} value={v}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm hover:bg-blue-700">搜索</button>
        <Link href="/dashboard/rfq-invitations" className="text-sm text-slate-500 px-2 hover:text-slate-700">
          重置
        </Link>
      </form>

      {invitations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center text-sm text-slate-400">
          暂无询价邀请记录
          <div className="mt-2">
            <Link href="/dashboard/rfqs" className="text-blue-600 font-medium">
              在询价详情页点击「邀请供应商报价」→
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
                    <th className="text-left px-4 py-2.5">询价单号</th>
                    <th className="text-left px-4 py-2.5">询价标题</th>
                    <th className="text-left px-4 py-2.5">供应商</th>
                    <th className="text-left px-4 py-2.5">邀请时间</th>
                    <th className="text-left px-4 py-2.5">查看时间</th>
                    <th className="text-left px-4 py-2.5">响应状态</th>
                    <th className="text-left px-4 py-2.5">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => {
                    const st = statusMap[inv.status] || { label: inv.status, cls: "bg-gray-100 text-gray-600" };
                    const supplierName = inv.supplier?.name || inv.externalCompanyName || "外部供应商";
                    return (
                      <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {inv.rfq?.rfqNo || `#${inv.rfqId}`}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[180px] truncate">
                          {inv.rfq?.title}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {inv.supplier ? (
                            <Link href={`/suppliers/${inv.supplier.slug}`} className="text-blue-600 hover:underline">
                              {supplierName}
                            </Link>
                          ) : (
                            supplierName
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(inv.invitedAt).toLocaleString("zh-CN")}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                          {inv.viewedAt ? new Date(inv.viewedAt).toLocaleString("zh-CN") : "-"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[11px] px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                          {inv.status === "REJECTED" && inv.rejectReason && (
                            <div className="text-[11px] text-slate-400 mt-0.5 max-w-[140px] truncate" title={inv.rejectReason}>
                              {inv.rejectReason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Link href={`/dashboard/rfqs/${inv.rfqId}`} className="text-blue-600 hover:underline text-xs font-medium">
                            查看询价
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
            {invitations.map((inv) => {
              const st = statusMap[inv.status] || { label: inv.status, cls: "bg-gray-100 text-gray-600" };
              const supplierName = inv.supplier?.name || inv.externalCompanyName || "外部供应商";
              return (
                <div key={inv.id} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 text-sm truncate">{inv.rfq?.title}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {inv.rfq?.rfqNo || `#${inv.rfqId}`}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">供应商：{supplierName}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    邀请：{new Date(inv.invitedAt).toLocaleString("zh-CN")}
                    {inv.viewedAt && ` · 查看：${new Date(inv.viewedAt).toLocaleString("zh-CN")}`}
                  </div>
                  <div className="mt-3">
                    <Link
                      href={`/dashboard/rfqs/${inv.rfqId}`}
                      className="inline-block w-full text-center bg-blue-600 text-white rounded-lg py-2 text-sm font-medium"
                    >
                      查看询价
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} makeHref={makeHref} />
    </div>
  );
}
