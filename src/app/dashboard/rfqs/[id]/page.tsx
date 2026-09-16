export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { closeMyRfq, deleteMyRfq } from "../actions";
import { RfqDangerActions } from "./RfqDangerActions";
import InvitationSection from "./InvitationSection";
import { buildItemRanks, quotedSupplierCount, type ComparisonItem, type ComparisonQuote } from "@/lib/rfq-comparison";

const statusMap: Record<string, { label: string; cls: string }> = {
  COLLECTING: { label: "征集中", cls: "bg-blue-50 text-blue-700" },
  QUOTED: { label: "已报价", cls: "bg-green-50 text-green-700" },
  SELECTED: { label: "已选定", cls: "bg-green-50 text-green-700" },
  CLOSED: { label: "已关闭", cls: "bg-gray-100 text-gray-600" },
  EXPIRED: { label: "已过期", cls: "bg-red-50 text-red-600" },
  REJECTED: { label: "已驳回", cls: "bg-red-50 text-red-600" },
};

const PAGE_SIZES = [20, 50, 100];

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v;
  } catch {
    /* 兼容逗号分隔旧数据 */
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export default async function BuyerRfqDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { page?: string; pageSize?: string; invPage?: string; invPageSize?: string };
}) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true },
  });
  if (!user) redirect("/login");

  // 服务端归属校验：只允许发布者本人查看/管理自己的 RFQ（防止横向越权访问他人询价）
  const rfqBase = await prisma.rFQ.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      rfqNo: true,
      status: true,
      createdAt: true,
      userID: true,
      contactName: true,
      contactPhone: true,
      deliveryLocation: true,
      deliveryDate: true,
      incoterm: true,
      expiresAt: true,
      _count: { select: { items: true } },
    },
  });
  if (!rfqBase) notFound();
  if (rfqBase.userID !== user.id) notFound();

  // ===== 分项比价：RFQItem 数据库级分页（分页单位是采购明细，不是 QuoteItem）=====
  const totalItems = rfqBase._count.items;
  const pageSize = PAGE_SIZES.includes(parseInt(searchParams.pageSize || ""))
    ? parseInt(searchParams.pageSize || "20")
    : 20;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requestedPage = parseInt(searchParams.page || "1");
  const page = isNaN(requestedPage) || requestedPage < 1 ? 1 : Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;

  const items = (await prisma.rFQItem.findMany({
    where: { rfqId: id },
    include: { partNumber: true },
    orderBy: { seq: "asc" }, // 按采购商原始询价顺序稳定排序
    skip,
    take: pageSize,
  })) as ComparisonItem[];

  // 供应商报价全量读取（供应商数量通常远小于采购明细数，不参与分页）
  const quotes = (await prisma.quote.findMany({
    where: { rfqId: id },
    include: { supplier: true, items: true },
    orderBy: { createdAt: "asc" },
  })) as ComparisonQuote[];

  const itemRanks = buildItemRanks(items, quotes);
  const quotedSuppliers = quotedSupplierCount(quotes);
  const st = statusMap[rfqBase.status] || { label: rfqBase.status, cls: "bg-gray-100 text-gray-600" };

  function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) return <span className="ml-1" title="价格第 1 名">🥇</span>;
    if (rank === 2) return <span className="ml-1" title="价格第 2 名">🥈</span>;
    if (rank === 3) return <span className="ml-1" title="价格第 3 名">🥉</span>;
    return <span className="ml-1 text-[10px] text-gray-400">#{rank}</span>;
  }

  const href = (p: number, ps: number) => `/dashboard/rfqs/${id}?page=${p}&pageSize=${ps}`;

  // 分页控件（保留 RFQ ID；搜索/筛选参数若有新增也需在此拼接保留）
  function Pagination() {
    if (totalItems <= pageSize) return null;
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return (
      <div className="flex flex-wrap items-center gap-3 mt-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 mr-1">每页</span>
          <Link
            href={href(1, PAGE_SIZES[0])}
            aria-label="切换每页条数"
            className={`h-8 rounded-md border px-2 text-xs leading-8 ${pageSize === 20 ? "border-blue-600 text-blue-600" : "border-[#dce2e6] bg-white"}`}>
            20 条
          </Link>
          <Link
            href={href(1, 50)}
            aria-label="切换每页条数"
            className={`h-8 rounded-md border px-2 text-xs leading-8 ${pageSize === 50 ? "border-blue-600 text-blue-600" : "border-[#dce2e6] bg-white"}`}>
            50 条
          </Link>
          <Link
            href={href(1, 100)}
            aria-label="切换每页条数"
            className={`h-8 rounded-md border px-2 text-xs leading-8 ${pageSize === 100 ? "border-blue-600 text-blue-600" : "border-[#dce2e6] bg-white"}`}>
            100 条
          </Link>
        </div>
        <div className="flex items-center gap-1">
          {page > 1 && (
            <Link href={href(page - 1, pageSize)} className="border rounded px-2.5 py-1 hover:bg-gray-50">
              上一页
            </Link>
          )}
          {pages.map((p) => (
            <Link
              key={p}
              href={href(p, pageSize)}
              className={`border rounded px-2.5 py-1 ${p === page ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-50"}`}>
              {p}
            </Link>
          ))}
          {page < totalPages && (
            <Link href={href(page + 1, pageSize)} className="border rounded px-2.5 py-1 hover:bg-gray-50">
              下一页
            </Link>
          )}
        </div>
        <span className="text-xs text-gray-400">
          第 {page} / {totalPages} 页 · 共 {totalItems} 个采购项目
        </span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <Link href="/dashboard/rfqs" className="text-sm text-gray-500 hover:text-blue-600">← 返回我的询价</Link>
          <h1 className="text-xl font-bold mt-1 flex items-center gap-2 flex-wrap">
            {rfqBase.title}
            <span className={`inline-block text-xs px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
          </h1>
          {rfqBase.rfqNo && <p className="text-xs font-mono text-gray-400 mt-0.5">{rfqBase.rfqNo}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {quotes.length > 0 && (
            <a
              href={`/api/rfq/${rfqBase.id}/export`}
              className="inline-block bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
            >
              导出报价 (Excel)
            </a>
          )}
          {(rfqBase.status === "COLLECTING" || rfqBase.status === "QUOTED" || rfqBase.status === "SELECTED") && (
            <Link
              href={`/dashboard/rfqs/${rfqBase.id}/invite`}
              className="inline-block border border-blue-600 text-blue-600 text-sm px-4 py-2 rounded hover:bg-blue-50"
            >
              邀请供应商报价
            </Link>
          )}
          <RfqDangerActions
            rfqId={rfqBase.id}
            canClose={rfqBase.status === "COLLECTING" || rfqBase.status === "QUOTED" || rfqBase.status === "SELECTED"}
            hasQuotes={quotes.length > 0}
            closeAction={closeMyRfq.bind(null, rfqBase.id)}
            deleteAction={deleteMyRfq.bind(null, rfqBase.id)}
          />
        </div>
      </div>

      {/* 基本信息 */}
      <div className="bg-white border rounded-lg p-5 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-400 block text-xs">采购明细</span>{totalItems} 项</div>
          <div><span className="text-gray-400 block text-xs">已收报价</span>{quotedSuppliers} 家</div>
          <div><span className="text-gray-400 block text-xs">联系人</span>{rfqBase.contactName} {rfqBase.contactPhone}</div>
          <div><span className="text-gray-400 block text-xs">发布时间</span>{new Date(rfqBase.createdAt).toLocaleDateString("zh-CN")}</div>
          {rfqBase.deliveryLocation && <div><span className="text-gray-400 block text-xs">交货地点</span>{rfqBase.deliveryLocation}</div>}
          {rfqBase.deliveryDate && <div><span className="text-gray-400 block text-xs">期望交期</span>{new Date(rfqBase.deliveryDate).toLocaleDateString("zh-CN")}</div>}
          {rfqBase.incoterm && <div><span className="text-gray-400 block text-xs">贸易条款</span>{rfqBase.incoterm}</div>}
          {rfqBase.expiresAt && <div><span className="text-gray-400 block text-xs">截止时间</span>{new Date(rfqBase.expiresAt).toLocaleDateString("zh-CN")}</div>}
        </div>
      </div>

      {/* 采购明细（与分项比价共用同一数据库分页） */}
      <div className="bg-white border rounded-lg p-5 mb-4">
        <h2 className="font-bold mb-1">采购明细（{totalItems} 项）</h2>
        <p className="text-xs text-gray-400 mb-3">第 {page} / {totalPages} 页 · 显示第 {skip + 1}–{Math.min(skip + pageSize, totalItems)} 项</p>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">该询价暂无采购明细</p>
        ) : (
          <div className="space-y-3">
            {items.map((it) => {
              const imgs = parseImages(it.images);
              return (
                <div key={it.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-bold bg-gray-100 rounded px-2 py-0.5">Item {it.seq}</span>
                    {it.brandName && <span className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">{it.brandName}</span>}
                    {it.equipmentModel && <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{it.equipmentModel}</span>}
                    {(it.partNumberStr || it.partNumber?.number) && (
                      <span className="text-xs font-mono bg-gray-100 rounded px-2 py-0.5">
                        {it.partNumberStr || it.partNumber?.number}
                      </span>
                    )}
                  </div>
                  <div className="text-sm">
                    {it.productName && <p className="font-medium">{it.productName}</p>}
                    <p className="text-gray-500 text-xs mt-1">数量：{it.quantity} {it.unit}</p>
                    {it.description && <p className="text-gray-500 text-xs mt-1 leading-relaxed">{it.description}</p>}
                  </div>
                  {imgs.length > 0 && (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-3">
                      {imgs.map((src) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={src} src={src} alt={`Item ${it.seq}`}
                          className="h-20 w-full object-cover rounded border" />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <Pagination />
      </div>

      {/* 报价汇总（仅采购方本人可见） */}
      <div className="bg-white border rounded-lg p-5 mb-4">
        <h2 className="font-bold mb-1">报价汇总</h2>
        <p className="text-xs text-gray-400 mb-3">
          总项目 {totalItems} 项 · 已报价供应商 {quotedSuppliers} 家 · 排名按同一明细同一币种价格从低到高
        </p>
        {quotes.length === 0 ? (
          <p className="text-sm text-gray-400">暂无供应商报价</p>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => {
              const hasItems = q.items.length > 0;
              const legacyPrice = !hasItems && q.unitPrice != null ? q.unitPrice : null;
              return (
                <div key={q.id} className="flex justify-between items-center border border-gray-200 rounded-lg px-4 py-2.5 text-sm">
                  <span className="font-medium">{q.supplier.shortName || q.supplier.name}</span>
                  <span className="text-xs">
                    {legacyPrice != null ? (
                      <span className="text-gray-500">历史总价：{q.currency} {legacyPrice.toLocaleString()}</span>
                    ) : hasItems && q.totalAmount != null ? (
                      <span className="font-semibold text-green-700">
                        完整报价 {q.quotedCount}/{totalItems} 项 · 总额 {q.items[0]?.currency || "CNY"} {q.totalAmount.toLocaleString()}
                      </span>
                    ) : hasItems && q.quotedCount > 0 ? (
                      <span className="text-amber-600">部分报价：{q.quotedCount}/{totalItems} 项</span>
                    ) : (
                      <span className="text-gray-400">未报价</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 分项比价（仅采购方本人可见；与采购明细同一数据库分页） */}
      {quotes.length > 0 && (
        <div className="bg-white border rounded-lg p-5 mb-4 overflow-x-auto">
          <h2 className="font-bold mb-1">分项比价</h2>
          <p className="text-xs text-gray-400 mb-1">
            价格排名按同一明细、同一币种从低到高；不同币种不互相比较。最低价仅为价格第 1 名，不代表“最佳供应商”。
          </p>
          <p className="text-xs text-gray-400 mb-4">第 {page} / {totalPages} 页 · 显示第 {skip + 1}–{Math.min(skip + pageSize, totalItems)} 项</p>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 px-2">件号</th>
                <th className="py-2 px-2">配件名称</th>
                <th className="py-2 px-2">数量</th>
                {quotes.map((q) => (
                  <th key={q.id} className="py-2 px-2 whitespace-nowrap">
                    {q.supplier.shortName || q.supplier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const row = itemRanks[item.id] || {};
                return (
                  <tr key={item.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <span className="text-xs font-bold bg-gray-100 rounded px-1.5 py-0.5">Item {item.seq}</span>
                    </td>
                    <td className="py-2 px-2 font-mono text-xs">{item.partNumberStr || item.partNumber?.number || "—"}</td>
                    <td className="py-2 px-2 text-xs">{item.productName || "—"}</td>
                    <td className="py-2 px-2 whitespace-nowrap text-xs">{item.quantity} {item.unit}</td>
                    {quotes.map((q) => {
                      const c = row[q.id];
                      if (!c) return <td key={q.id} className="py-2 px-2 text-xs text-gray-400">—</td>;
                      return (
                        <td key={q.id} className="py-2 px-2 whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold">
                            {c.currency} {c.price.toLocaleString()}
                          </span>
                          {c.rank != null && <RankBadge rank={c.rank} />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination />
        </div>
      )}
      {/* 询价邀请（归属校验已在页面层完成） */}
      <InvitationSection
        rfqId={rfqBase.id}
        page={parseInt(searchParams.invPage || "1") || 1}
        pageSize={parseInt(searchParams.invPageSize || "10") || 10}
      />
    </div>
  );
}
