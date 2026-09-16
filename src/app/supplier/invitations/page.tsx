export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { INV_STATUS_CN } from "@/lib/rfq-invitation";
import RespondClient from "./RespondClient";
import { acceptInvitationAction } from "./actions";

const PAGE_SIZE = 20;

export default async function SupplierInvitationsPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string; highlight?: string };
}) {
  const session = await auth();
  const email = (session?.user as any)?.email;
  if (!email) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email },
    select: { supplierId: true, role: true },
  });
  if (!user || user.role !== "SUPPLIER" || !user.supplierId) redirect("/supplier");

  const supplierId = user.supplierId;
  const page = Math.max(1, parseInt(searchParams.page || "1") || 1);
  const pageSize = [20, 50, 100].includes(parseInt(searchParams.pageSize || "20"))
    ? parseInt(searchParams.pageSize || "20")
    : 20;

  const where = { supplierId };
  const total = await prisma.rFQInvitation.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, totalPages);

  const invitations = await prisma.rFQInvitation.findMany({
    where,
    include: {
      rfq: {
        select: {
          id: true,
          rfqNo: true,
          title: true,
          status: true,
          expiresAt: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          userID: true,
          _count: { select: { items: true, quotes: true } },
        },
      },
    },
    orderBy: { invitedAt: "desc" },
    skip: (cur - 1) * pageSize,
    take: pageSize,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">询价邀请</h1>
          <p className="text-sm text-gray-500 mt-1">采购方主动邀请您报价的询价单，请及时响应</p>
        </div>
        <Link href="/supplier/rfqs" className="text-sm text-blue-600">浏览询价大厅 →</Link>
      </div>

      {invitations.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">
          <p className="text-lg font-medium mb-1">暂无询价邀请</p>
          <p className="text-sm">采购方邀请您报价后，会显示在这里。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invitations.map((inv) => {
            const buyer = inv.rfq.contactName || "-";
            const isRejected = inv.status === "REJECTED";
            const isQuoted = inv.status === "QUOTED";
            return (
              <div
                key={inv.id}
                id={searchParams.highlight === String(inv.id) ? "hl" : undefined}
                className="bg-white border rounded-lg p-5"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-blue-700">{inv.rfq.rfqNo || `#${inv.rfq.id}`}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          isRejected
                            ? "bg-red-100 text-red-700"
                            : isQuoted
                            ? "bg-green-100 text-green-700"
                            : inv.status === "ACCEPTED"
                            ? "bg-blue-100 text-blue-700"
                            : inv.status === "VIEWED"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {INV_STATUS_CN[inv.status] || inv.status}
                      </span>
                      {inv.reminderCount > 1 && (
                        <span className="text-xs text-orange-600">已提醒 {inv.reminderCount} 次</span>
                      )}
                    </div>
                    <h2 className="font-bold mt-1">{inv.rfq.title}</h2>
                    <div className="text-sm text-gray-500 mt-1">
                      采购方：{buyer}
                      {inv.rfq.contactPhone ? ` · ${inv.rfq.contactPhone}` : ""}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {inv.rfq._count.items} 个采购项目 · 当前报价 {inv.rfq._count.quotes} 家 · 邀请时间{" "}
                      {inv.invitedAt.toLocaleString("zh-CN")}
                      {inv.rfq.expiresAt ? ` · 截止 ${inv.rfq.expiresAt.toLocaleString("zh-CN")}` : ""}
                    </div>
                    {inv.rejectReason && (
                      <div className="text-xs text-red-600 mt-1">暂不报价原因：{inv.rejectReason}</div>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {isRejected ? (
                      <span className="text-xs text-gray-400 self-center">已拒绝</span>
                    ) : isQuoted ? (
                      <Link
                        href={`/rfq/${inv.rfq.id}/quote`}
                        className="bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded text-sm"
                      >
                        查看已提交报价
                      </Link>
                    ) : (
                      <>
                        <form action={acceptInvitationAction}>
                          <input type="hidden" name="invitationId" value={inv.id} />
                          <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                            接受并报价
                          </button>
                        </form>
                        <RespondClient invitationId={inv.id} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 数据库级分页 */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 bg-white border rounded-lg p-3 text-sm">
          <span className="text-gray-500">
            共 {total} 条 · 第 {cur} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={`/supplier/invitations?page=${Math.max(1, cur - 1)}&pageSize=${pageSize}`}
              className={`px-3 py-1.5 border rounded ${cur <= 1 ? "opacity-40 pointer-events-none" : "hover:bg-gray-50"}`}
            >
              上一页
            </Link>
            <span className="px-3 py-1.5 bg-blue-600 text-white rounded">{cur}</span>
            <Link
              href={`/supplier/invitations?page=${Math.min(totalPages, cur + 1)}&pageSize=${pageSize}`}
              className={`px-3 py-1.5 border rounded ${cur >= totalPages ? "opacity-40 pointer-events-none" : "hover:bg-gray-50"}`}
            >
              下一页
            </Link>
            <select
              defaultValue={pageSize}
              onChange={(e) => {
                const v = e.target.value;
                window.location.href = `/supplier/invitations?page=1&pageSize=${v}`;
              }}
              className="border rounded px-2 py-1.5 text-sm"
            >
              {[20, 50, 100].map((n) => (
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
