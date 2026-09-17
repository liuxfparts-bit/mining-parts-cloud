export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

const PAGE_SIZES = [20, 50, 100];

export default async function SupplierRfqs({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((session.user as any).email).toLowerCase() },
    select: { supplierId: true },
  });
  if (!user?.supplierId) redirect("/supplier");

  // ===== 数据库级分页：只查询当前页 =====
  const pageSize = PAGE_SIZES.includes(parseInt(searchParams.pageSize || ""))
    ? parseInt(searchParams.pageSize || "20")
    : 20;
  const total = await prisma.rFQ.count({
    where: { status: "COLLECTING", visibility: "PUBLIC", quotes: { none: { supplierId: user.supplierId } } },
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requested = parseInt(searchParams.page || "1");
  const page = isNaN(requested) || requested < 1 ? 1 : Math.min(requested, totalPages);
  const skip = (page - 1) * pageSize;

  const openRfqs = await prisma.rFQ.findMany({
    where: { status: "COLLECTING", visibility: "PUBLIC", quotes: { none: { supplierId: user.supplierId } } },
    include: {
      partNumber: { include: { brand: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
  });

  const href = (p: number, ps: number) => `/supplier/rfqs?page=${p}&pageSize=${ps}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">待处理询价（询价大厅）</h1>
          <p className="text-sm text-gray-500 mt-1">
            公开征集中的采购需求，共 {total} 条待报价
          </p>
        </div>
        <Link href="/supplier/profile" className="border px-4 py-2 rounded text-sm text-slate-600 hover:bg-slate-50">
          订阅配件通知 / 设置接单偏好
        </Link>
      </div>

      {openRfqs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center text-gray-500">
          暂无待报价的公开询价
        </div>
      ) : (
        <div className="space-y-3">
          {openRfqs.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 flex items-center gap-2 flex-wrap">
                  {r.title}
                  {r.rfqNo && <span className="text-[11px] font-mono text-slate-400">{r.rfqNo}</span>}
                </div>
                <div className="flex gap-2 mt-2 text-xs text-slate-500 flex-wrap">
                  <span className="font-mono border rounded px-1.5 py-0.5">
                    {r.partNumberStr || r.partNumber?.number || "-"}
                  </span>
                  {r.brandName && <span className="bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{r.brandName}</span>}
                  {r.equipmentModel && (
                    <span className="bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5">{r.equipmentModel}</span>
                  )}
                  {r._count.items > 0 && <span>{r._count.items} 项采购明细</span>}
                  <span>数量：{r.quantity} {r.unit}</span>
                  {r.expiresAt && <span className="text-orange-600">截止：{new Date(r.expiresAt).toLocaleDateString("zh-CN")}</span>}
                </div>
                <div className="text-xs text-gray-400 mt-1">采购方：{r.contactName}</div>
              </div>
              <Link
                href={`/supplier/rfqs/${r.id}`}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm whitespace-nowrap hover:bg-blue-700 text-center"
              >
                去报价 →
              </Link>
            </div>
          ))}
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
                window.location.href = `/supplier/rfqs?page=1&pageSize=${v}`;
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
