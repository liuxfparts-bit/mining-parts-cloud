export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { closeMyRfq, deleteMyRfq } from "../actions";
import { RfqDangerActions } from "./RfqDangerActions";

const statusMap: Record<string, { label: string; cls: string }> = {
  COLLECTING: { label: "征集中", cls: "bg-blue-50 text-blue-700" },
  QUOTED: { label: "已报价", cls: "bg-green-50 text-green-700" },
  SELECTED: { label: "已选定", cls: "bg-green-50 text-green-700" },
  CLOSED: { label: "已关闭", cls: "bg-gray-100 text-gray-600" },
  EXPIRED: { label: "已过期", cls: "bg-red-50 text-red-600" },
  REJECTED: { label: "已驳回", cls: "bg-red-50 text-red-600" },
};

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

export default async function BuyerRfqDetail({ params }: { params: { id: string } }) {
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
  const rfq = await prisma.rFQ.findUnique({
    where: { id },
    include: {
      items: { include: { partNumber: true }, orderBy: { seq: "asc" } },
      quotes: { include: { supplier: true, items: true } },
    },
  });
  if (!rfq) notFound();
  if (rfq.userID !== user.id) notFound();

  const st = statusMap[rfq.status] || { label: rfq.status, cls: "bg-gray-100 text-gray-600" };

  // 分项比价：同一 RFQItem + 同一币种排名（采购方视角）
  type RankCell = { price: number; currency: string; rank: number | null };
  const itemRanks: Record<number, Record<number, RankCell>> = {};
  for (const item of rfq.items) {
    const cells: { qId: number; price: number; currency: string }[] = [];
    for (const q of rfq.quotes) {
      const qi = q.items.find((x) => x.rfqItemId === item.id);
      if (qi?.unitPrice != null) cells.push({ qId: q.id, price: qi.unitPrice, currency: qi.currency });
    }
    const byCur = new Map<string, { qId: number; price: number }[]>();
    for (const c of cells) {
      if (!byCur.has(c.currency)) byCur.set(c.currency, []);
      byCur.get(c.currency)!.push({ qId: c.qId, price: c.price });
    }
    const row: Record<number, RankCell> = {};
    for (const cur of Array.from(byCur.keys())) {
      const arr = byCur.get(cur)!;
      const sorted = [...arr].sort((a, b) => a.price - b.price);
      sorted.forEach((p, idx) => {
        row[p.qId] = { price: p.price, currency: cur, rank: idx + 1 };
      });
    }
    itemRanks[item.id] = row;
  }
  const quotedSuppliers = rfq.quotes.filter((q) => q.items.length > 0 || q.unitPrice != null).length;

  function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) return <span className="ml-1" title="价格第 1 名">🥇</span>;
    if (rank === 2) return <span className="ml-1" title="价格第 2 名">🥈</span>;
    if (rank === 3) return <span className="ml-1" title="价格第 3 名">🥉</span>;
    return <span className="ml-1 text-[10px] text-gray-400">#{rank}</span>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <Link href="/dashboard/rfqs" className="text-sm text-gray-500 hover:text-blue-600">← 返回我的询价</Link>
          <h1 className="text-xl font-bold mt-1 flex items-center gap-2 flex-wrap">
            {rfq.title}
            <span className={`inline-block text-xs px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
          </h1>
          {rfq.rfqNo && <p className="text-xs font-mono text-gray-400 mt-0.5">{rfq.rfqNo}</p>}
        </div>
        <RfqDangerActions
          rfqId={rfq.id}
          canClose={rfq.status === "COLLECTING" || rfq.status === "QUOTED" || rfq.status === "SELECTED"}
          hasQuotes={rfq.quotes.length > 0}
          closeAction={closeMyRfq.bind(null, rfq.id)}
          deleteAction={deleteMyRfq.bind(null, rfq.id)}
        />
      </div>

      {/* 基本信息 */}
      <div className="bg-white border rounded-lg p-5 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-400 block text-xs">采购明细</span>{rfq.items.length} 项</div>
          <div><span className="text-gray-400 block text-xs">已收报价</span>{quotedSuppliers} 家</div>
          <div><span className="text-gray-400 block text-xs">联系人</span>{rfq.contactName} {rfq.contactPhone}</div>
          <div><span className="text-gray-400 block text-xs">发布时间</span>{new Date(rfq.createdAt).toLocaleDateString("zh-CN")}</div>
          {rfq.deliveryLocation && <div><span className="text-gray-400 block text-xs">交货地点</span>{rfq.deliveryLocation}</div>}
          {rfq.deliveryDate && <div><span className="text-gray-400 block text-xs">期望交期</span>{new Date(rfq.deliveryDate).toLocaleDateString("zh-CN")}</div>}
          {rfq.incoterm && <div><span className="text-gray-400 block text-xs">贸易条款</span>{rfq.incoterm}</div>}
          {rfq.expiresAt && <div><span className="text-gray-400 block text-xs">截止时间</span>{new Date(rfq.expiresAt).toLocaleDateString("zh-CN")}</div>}
        </div>
      </div>

      {/* 采购明细 */}
      <div className="bg-white border rounded-lg p-5 mb-4">
        <h2 className="font-bold mb-3">采购明细（{rfq.items.length} 项）</h2>
        {rfq.items.length === 0 ? (
          <p className="text-sm text-gray-400">该询价暂无采购明细</p>
        ) : (
          <div className="space-y-3">
            {rfq.items.map((it) => {
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
      </div>

      {/* 报价汇总（仅采购方本人可见） */}
      <div className="bg-white border rounded-lg p-5 mb-4">
        <h2 className="font-bold mb-1">报价汇总</h2>
        <p className="text-xs text-gray-400 mb-3">
          总项目 {rfq.items.length} 项 · 已报价供应商 {quotedSuppliers} 家 · 排名按同一明细同一币种价格从低到高
        </p>
        {rfq.quotes.length === 0 ? (
          <p className="text-sm text-gray-400">暂无供应商报价</p>
        ) : (
          <div className="space-y-2">
            {rfq.quotes.map((q) => {
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
                        完整报价 {q.quotedCount}/{rfq.items.length} 项 · 总额 {q.items[0]?.currency || "CNY"} {q.totalAmount.toLocaleString()}
                      </span>
                    ) : hasItems && q.quotedCount > 0 ? (
                      <span className="text-amber-600">部分报价：{q.quotedCount}/{rfq.items.length} 项</span>
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

      {/* 分项比价（仅采购方本人可见） */}
      {rfq.quotes.length > 0 && (
        <div className="bg-white border rounded-lg p-5 mb-4 overflow-x-auto">
          <h2 className="font-bold mb-1">分项比价</h2>
          <p className="text-xs text-gray-400 mb-4">
            价格排名按同一明细、同一币种从低到高；不同币种不互相比较。最低价仅为价格第 1 名，不代表“最佳供应商”。
          </p>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 px-2">件号</th>
                <th className="py-2 px-2">配件名称</th>
                <th className="py-2 px-2">数量</th>
                {rfq.quotes.map((q) => (
                  <th key={q.id} className="py-2 px-2 whitespace-nowrap">
                    {q.supplier.shortName || q.supplier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rfq.items.map((item) => {
                const row = itemRanks[item.id] || {};
                return (
                  <tr key={item.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <span className="text-xs font-bold bg-gray-100 rounded px-1.5 py-0.5">Item {item.seq}</span>
                    </td>
                    <td className="py-2 px-2 font-mono text-xs">{item.partNumberStr || item.partNumber?.number || "—"}</td>
                    <td className="py-2 px-2 text-xs">{item.productName || "—"}</td>
                    <td className="py-2 px-2 whitespace-nowrap text-xs">{item.quantity} {item.unit}</td>
                    {rfq.quotes.map((q) => {
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
        </div>
      )}
    </div>
  );
}
