export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updateRfqStatus } from "../../actions";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  COLLECTING: { label: "征集中", cls: "bg-green-100 text-green-700" },
  CLOSED: { label: "已关闭", cls: "bg-gray-100 text-gray-600" },
  REJECTED: { label: "已驳回", cls: "bg-red-100 text-red-700" },
  QUOTED: { label: "已报价", cls: "bg-blue-100 text-blue-700" },
  SELECTED: { label: "已选定", cls: "bg-blue-100 text-blue-700" },
};

function parseJsonList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v;
  } catch {
    /* 兼容逗号分隔旧数据 */
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="ml-1">🥇</span>;
  if (rank === 2) return <span className="ml-1">🥈</span>;
  if (rank === 3) return <span className="ml-1">🥉</span>;
  return <span className="ml-1 text-[10px] text-muted">#{rank}</span>;
}

export default async function RfqDetail({ params }: { params: { id: string } }) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      partNumber: { include: { brand: true, equipmentRelations: { include: { equipmentModel: true } } } },
      brand: true,
      equipment: true,
      items: { include: { partNumber: { include: { brand: true } } }, orderBy: { seq: "asc" } },
      quotes: { include: { supplier: true, items: true } },
    },
  });
  if (!rfq) notFound();

  const imgs = parseJsonList(rfq.images);
  const atts = parseJsonList(rfq.attachments);
  const st = STATUS_LABEL[rfq.status] || { label: rfq.status, cls: "bg-gray-100" };

  // 分项比价排名：同 RFQItem + 同币种升序
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

  return (
    <div className="p-6">
      <a href="/admin/rfqs" className="text-sm text-blue-600 hover:underline">← 返回询价列表</a>

      {/* RFQ 基本信息 */}
      <div className="bg-white rounded-lg border p-6 mt-4">
        <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold">{rfq.title}</h1>
            <p className="text-xs font-mono text-gray-500 mt-1">{rfq.rfqNo || `#${rfq.id}`} · 创建于 {rfq.createdAt.toLocaleString("zh-CN")}</p>
          </div>
          <span className={`px-3 py-1 rounded text-sm ${st.cls}`}>{st.label}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-gray-500">采购方：</span>{rfq.contactName} {rfq.contactPhone ? `（${rfq.contactPhone}）` : ""}</div>
          <div><span className="text-gray-500">Email：</span>{rfq.contactEmail || "-"}</div>
          <div><span className="text-gray-500">WhatsApp：</span>{rfq.whatsapp || "-"}</div>
          <div><span className="text-gray-500">类型：</span>{rfq.purchaseType}</div>
          <div><span className="text-gray-500">交货地：</span>{rfq.deliveryLocation || "-"}</div>
          <div><span className="text-gray-500">贸易术语：</span>{rfq.incoterm || "-"}</div>
          <div><span className="text-gray-500">期望交期：</span>{rfq.deliveryDate ? new Date(rfq.deliveryDate).toLocaleDateString("zh-CN") : "-"}</div>
          <div><span className="text-gray-500">截止时间：</span>{rfq.expiresAt ? new Date(rfq.expiresAt).toLocaleString("zh-CN") : "-"}</div>
          <div><span className="text-gray-500">可见性：</span>{rfq.visibility}</div>
        </div>
        {rfq.description && <p className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">{rfq.description}</p>}

        {imgs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-bold mb-2">询价图片 / 图纸</h3>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {imgs.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={src} href={src} target="_blank">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-24 w-full object-cover rounded border" />
                </a>
              ))}
            </div>
          </div>
        )}
        {atts.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-bold mb-2">询价附件（Word / PDF / Excel）</h3>
            <div className="flex flex-wrap gap-2">
              {atts.map((u) => (
                <a key={u} href={u} target="_blank"
                  className="text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded px-2 py-1 hover:bg-blue-100">
                  {u.split("/").pop()}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 采购明细 */}
      <div className="bg-white rounded-lg border p-6 mt-4">
        <h2 className="font-bold mb-3">采购明细（{rfq.items.length} 项）</h2>
        {rfq.items.length === 0 ? (
          <p className="text-gray-500 text-sm">
            无分项明细。历史数据：{rfq.partNumber?.number || rfq.partNumberStr || "-"} / {rfq.productName || "-"} × {rfq.quantity} {rfq.unit}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Item</th>
                  <th className="text-left p-2">品牌</th>
                  <th className="text-left p-2">设备型号</th>
                  <th className="text-left p-2">配件名称</th>
                  <th className="text-left p-2">件号</th>
                  <th className="text-left p-2">数量</th>
                  <th className="text-left p-2">单位</th>
                  <th className="text-left p-2">描述</th>
                  <th className="text-left p-2">图片/图纸</th>
                </tr>
              </thead>
              <tbody>
                {rfq.items.map((it) => {
                  const itImgs = parseJsonList(it.images);
                  return (
                    <tr key={it.id} className="border-b align-top">
                      <td className="p-2 font-bold">Item {it.seq}</td>
                      <td className="p-2">{it.brandName || it.partNumber?.brand?.name || "-"}</td>
                      <td className="p-2">{it.equipmentModel || "-"}</td>
                      <td className="p-2">{it.productName || "-"}</td>
                      <td className="p-2 font-mono text-xs">{it.partNumberStr || it.partNumber?.number || "-"}</td>
                      <td className="p-2">{it.quantity}</td>
                      <td className="p-2">{it.unit}</td>
                      <td className="p-2 text-xs text-gray-500 max-w-[200px]">{it.description || "-"}</td>
                      <td className="p-2">
                        {itImgs.length > 0 ? (
                          <div className="flex gap-1">
                            {itImgs.map((src) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <a key={src} href={src} target="_blank">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt="" className="h-12 w-12 object-cover rounded border" />
                              </a>
                            ))}
                          </div>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分项比价排名 */}
      {rfq.quotes.length > 0 && rfq.items.length > 0 && (
        <div className="bg-white rounded-lg border p-6 mt-4 overflow-x-auto">
          <h2 className="font-bold mb-1">分项比价</h2>
          <p className="text-xs text-gray-500 mb-3">排名按同一明细、同一币种从低到高；不同币种不互相比较。</p>
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Item</th>
                <th className="text-left p-2">件号</th>
                <th className="text-left p-2">配件</th>
                <th className="text-left p-2">数量</th>
                {rfq.quotes.map((q) => (
                  <th key={q.id} className="text-left p-2 whitespace-nowrap">{q.supplier.shortName || q.supplier.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rfq.items.map((item) => {
                const row = itemRanks[item.id] || {};
                return (
                  <tr key={item.id} className="border-b align-top">
                    <td className="p-2 font-bold">Item {item.seq}</td>
                    <td className="p-2 font-mono text-xs">{item.partNumberStr || item.partNumber?.number || "-"}</td>
                    <td className="p-2 text-xs">{item.productName || "-"}</td>
                    <td className="p-2 text-xs">{item.quantity} {item.unit}</td>
                    {rfq.quotes.map((q) => {
                      const c = row[q.id];
                      if (!c) return <td key={q.id} className="p-2 text-xs text-gray-400">—</td>;
                      return (
                        <td key={q.id} className="p-2 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold">{c.currency} {c.price.toLocaleString()}</span>
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

      {/* 各供应商报价情况 */}
      <div className="bg-white rounded-lg border p-6 mt-4">
        <h2 className="font-bold mb-3">供应商报价（{rfq.quotes.length}）</h2>
        {rfq.quotes.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无报价</p>
        ) : (
          <div className="space-y-4">
            {rfq.quotes.map((q) => {
              const qAtts = parseJsonList(q.attachments);
              return (
                <div key={q.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
                    <div className="font-bold">{q.supplier.name}</div>
                    <div className="text-xs text-gray-500">
                      {q.items.length > 0 ? (
                        q.totalAmount != null ? (
                          <span className="text-green-700 font-bold">
                            完整报价 {q.quotedCount}/{rfq.items.length} 项 · 总额 {q.items[0]?.currency || "CNY"} {q.totalAmount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-amber-600">部分报价：{q.quotedCount}/{rfq.items.length} 项</span>
                        )
                      ) : q.unitPrice != null ? (
                        <span>历史总价：{q.currency} {q.unitPrice.toLocaleString()}</span>
                      ) : (
                        "未提交明细"
                      )}
                    </div>
                  </div>
                  {q.items.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[560px]">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-1.5">Item</th>
                            <th className="text-left p-1.5">件号</th>
                            <th className="text-left p-1.5">配件</th>
                            <th className="text-left p-1.5">单价</th>
                            <th className="text-left p-1.5">币种</th>
                            <th className="text-left p-1.5">交期</th>
                            <th className="text-left p-1.5">质量等级</th>
                            <th className="text-left p-1.5">备注</th>
                          </tr>
                        </thead>
                        <tbody>
                          {q.items.map((qi) => {
                            const it = rfq.items.find((x) => x.id === qi.rfqItemId);
                            return (
                              <tr key={qi.id} className="border-b">
                                <td className="p-1.5 font-bold">Item {it?.seq ?? "?"}</td>
                                <td className="p-1.5 font-mono">{it?.partNumberStr || it?.partNumber?.number || "-"}</td>
                                <td className="p-1.5">{it?.productName || "-"}</td>
                                <td className="p-1.5 font-mono font-bold">{qi.unitPrice != null ? qi.unitPrice.toLocaleString() : "-"}</td>
                                <td className="p-1.5">{qi.currency}</td>
                                <td className="p-1.5">{qi.leadTime || "-"}</td>
                                <td className="p-1.5">{qi.quality || "-"}</td>
                                <td className="p-1.5 text-gray-500 max-w-[160px]">{qi.remarks || "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {qAtts.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {qAtts.map((u) => (
                        <a key={u} href={u} target="_blank"
                          className="text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded px-2 py-1 hover:bg-blue-100">
                          报价附件：{u.split("/").pop()}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 修改状态 */}
      <div className="bg-white rounded-lg border p-6 mt-4">
        <h2 className="font-bold mb-3">修改状态</h2>
        <div className="flex gap-2 flex-wrap">
          {["COLLECTING", "QUOTED", "SELECTED", "CLOSED", "REJECTED"].map((s2) => (
            <form key={s2} action={async () => { "use server"; await updateRfqStatus(rfq.id, s2); }}>
              <button className={`px-3 py-1 rounded text-sm ${rfq.status === s2 ? "bg-blue-600 text-white" : "bg-gray-100"}`}>
                {STATUS_LABEL[s2]?.label || s2}
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
