import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { INV_STATUS_CN } from "@/lib/rfq-invitation";
import { remindInvitationAction } from "./invite-actions";

const PAGE_SIZES = [10, 20, 50];
const STATUS_CLS: Record<string, string> = {
  PENDING_VIEW: "bg-gray-100 text-gray-600",
  VIEWED: "bg-yellow-100 text-yellow-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  QUOTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-200 text-gray-500",
};

/**
 * 采购商"询价邀请"区块（RFQ 归属校验由父级页面完成）：
 * 统计卡片 + 数据库级分页明细列表 + 再次邀请
 */
export default async function InvitationSection({
  rfqId,
  page = 1,
  pageSize = 10,
}: {
  rfqId: number;
  page?: number;
  pageSize?: number;
}) {
  const size = PAGE_SIZES.includes(pageSize) ? pageSize : 10;

  // 统计卡片（按状态分组计数）
  const statusCounts = await prisma.rFQInvitation.groupBy({
    by: ["status"],
    where: { rfqId },
    _count: { _all: true },
  });
  const scMap = new Map(statusCounts.map((s) => [s.status, s._count._all]));
  const total = statusCounts.reduce((a, s) => a + s._count._all, 0);
  const pendingView = scMap.get("PENDING_VIEW") || 0;
  const viewed = scMap.get("VIEWED") || 0;
  const accepted = scMap.get("ACCEPTED") || 0;
  const quoted = scMap.get("QUOTED") || 0;
  const rejected = scMap.get("REJECTED") || 0;

  // 明细列表：数据库级分页
  const totalPages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(Math.max(1, page), totalPages);
  const invitations = await prisma.rFQInvitation.findMany({
    where: { rfqId },
    include: { supplier: { select: { id: true, name: true, shortName: true } } },
    orderBy: { invitedAt: "desc" },
    skip: (cur - 1) * size,
    take: size,
  });

  const href = (p: number, s: number) => `/dashboard/rfqs/${rfqId}?invPage=${p}&invPageSize=${s}`;

  const statCards = [
    { label: "已邀请", value: total, cls: "text-gray-900" },
    { label: "未查看", value: pendingView, cls: "text-gray-500" },
    { label: "已查看", value: viewed, cls: "text-yellow-600" },
    { label: "已接受", value: accepted, cls: "text-blue-600" },
    { label: "已报价", value: quoted, cls: "text-green-600" },
    { label: "已拒绝", value: rejected, cls: "text-red-600" },
  ];

  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-bold">询价邀请</h2>
          <p className="text-xs text-gray-400 mt-0.5">通过智能推荐或供应商库邀请供应商报价</p>
        </div>
        <Link
          href={`/dashboard/rfqs/${rfqId}/invite`}
          className="inline-block bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
        >
          + 邀请供应商报价
        </Link>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
        {statCards.map((c) => (
          <div key={c.label} className="border rounded-lg p-3 text-center">
            <div className={`text-xl font-bold ${c.cls}`}>{c.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* 明细列表 */}
      {invitations.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-gray-400 text-sm">
          尚未邀请供应商。点击右上角「邀请供应商报价」，系统将根据您的询价内容智能推荐精准供应商。
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
                <th className="py-2 pr-2">供应商</th>
                <th className="py-2 px-2">状态</th>
                <th className="py-2 px-2">邀请时间</th>
                <th className="py-2 px-2">查看时间</th>
                <th className="py-2 px-2">回复时间</th>
                <th className="py-2 px-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-100">
                  <td className="py-2 pr-2">
                    <div className="font-medium">{inv.supplier?.shortName || inv.supplier?.name || inv.externalCompanyName || "外部供应商"}</div>
                    {inv.supplierId == null && (
                      <div className="text-xs text-gray-400">
                        {inv.externalContactName || ""}
                        {inv.externalEmail ? ` · ${inv.externalEmail}` : ""}
                      </div>
                    )}
                    {inv.reminderCount > 1 && (
                      <div className="text-xs text-orange-600">已提醒 {inv.reminderCount} 次</div>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded ${STATUS_CLS[inv.status] || "bg-gray-100"}`}>
                      {INV_STATUS_CN[inv.status] || inv.status}
                    </span>
                    {inv.rejectReason && (
                      <div className="text-xs text-red-500 mt-1 max-w-[180px]">{inv.rejectReason}</div>
                    )}
                  </td>
                  <td className="py-2 px-2 text-xs text-gray-500">{inv.invitedAt.toLocaleString("zh-CN")}</td>
                  <td className="py-2 px-2 text-xs text-gray-500">{inv.viewedAt ? inv.viewedAt.toLocaleString("zh-CN") : "—"}</td>
                  <td className="py-2 px-2 text-xs text-gray-500">{inv.respondedAt ? inv.respondedAt.toLocaleString("zh-CN") : "—"}</td>
                  <td className="py-2 px-2">
                    <div className="flex gap-2">
                      {inv.status === "REJECTED" ? (
                        <form action={remindInvitationAction}>
                          <input type="hidden" name="invitationId" value={inv.id} />
                          <button className="text-xs text-blue-600 hover:underline">再次邀请</button>
                        </form>
                      ) : (
                        <form action={remindInvitationAction}>
                          <input type="hidden" name="invitationId" value={inv.id} />
                          <button className="text-xs text-blue-600 hover:underline">再次邀请</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 mr-1">每页</span>
            {PAGE_SIZES.map((n) => (
              <Link
                key={n}
                href={href(1, n)}
                className={`h-8 rounded-md border px-2 text-xs leading-8 ${size === n ? "border-blue-600 text-blue-600" : "border-[#dce2e6] bg-white"}`}>
                {n} 条
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {cur > 1 && (
              <Link href={href(cur - 1, size)} className="border rounded px-2.5 py-1 hover:bg-gray-50">上一页</Link>
            )}
            <span className="text-xs text-gray-400">第 {cur} / {totalPages} 页 · 共 {total} 条</span>
            {cur < totalPages && (
              <Link href={href(cur + 1, size)} className="border rounded px-2.5 py-1 hover:bg-gray-50">下一页</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
