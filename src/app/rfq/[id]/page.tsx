import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const statusMap: Record<string, { label: string; variant: "success" | "secondary" | "outline" | "destructive" }> = {
  COLLECTING: { label: "征集中", variant: "success" },
  QUOTED: { label: "已报价", variant: "secondary" },
  SELECTED: { label: "已选定", variant: "secondary" },
  CLOSED: { label: "已关闭", variant: "outline" },
  EXPIRED: { label: "已过期", variant: "destructive" },
};

const purchaseTypeMap: Record<string, string> = {
  STOCK: "现货采购",
  NORMAL: "常规采购",
  URGENT: "紧急采购",
  LONG_TERM: "长期采购",
  PROJECT: "项目采购",
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

export default async function RFQDetailPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  // 权限隔离：供应商只能看到自己的报价
  const s = await auth();
  const uid = s?.user ? parseInt(String((s.user as any).id)) : null;
  const me = uid
    ? await prisma.user.findUnique({ where: { id: uid }, select: { role: true, supplierId: true } })
    : null;
  const isSupplier = me?.role === "SUPPLIER" && me.supplierId !== null && me.supplierId !== undefined;
  const mySupplierId: number | null = isSupplier ? (me.supplierId as number) : null;

  const rfq = await prisma.rFQ.findUnique({
    where: { id },
    include: {
      partNumber: { include: { brand: true, equipment: true } },
      items: { include: { partNumber: true }, orderBy: { seq: "asc" } },
      quotes: mySupplierId
        ? { where: { supplierId: mySupplierId }, include: { supplier: true, items: true } }
        : { include: { supplier: true, items: true } },
    },
  });
  if (!rfq) notFound();

  const st = statusMap[rfq.status] || statusMap.COLLECTING;

  // ===== 分项比价：同一 RFQItem + 同一币种才排名（升序），供应商视角不可见 =====
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
    return <span className="ml-1 text-[10px] text-muted">#{rank}</span>;
  }

  return (
    <div className="container py-[42px]">
      <div className="max-w-[900px] mx-auto">
        <div className="bg-white border border-line rounded-lg p-8 mb-6">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
            <div>
              <h1 className="text-2xl font-bold">{rfq.title}</h1>
              {rfq.rfqNo && <p className="text-xs font-mono text-muted mt-1">{rfq.rfqNo}</p>}
            </div>
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
            <div><span className="text-muted">明细项数：</span>{rfq.items.length} 项</div>
            <div><span className="text-muted">类型：</span>{purchaseTypeMap[rfq.purchaseType] || rfq.purchaseType}</div>
            <div><span className="text-muted">联系人：</span>{rfq.contactName}</div>
            <div><span className="text-muted">发布：</span>{new Date(rfq.createdAt).toLocaleDateString("zh-CN")}</div>
            {rfq.deliveryLocation && <div><span className="text-muted">交货地：</span>{rfq.deliveryLocation}</div>}
            {rfq.incoterm && <div><span className="text-muted">贸易术语：</span>{rfq.incoterm}</div>}
            {rfq.expiresAt && <div><span className="text-muted">到期：</span>{new Date(rfq.expiresAt).toLocaleDateString("zh-CN")}</div>}
          </div>

          {/* 采购明细（多 Item） */}
          <h3 className="text-sm font-bold mb-3">采购明细（{rfq.items.length} 项）</h3>
          <div className="space-y-4">
            {rfq.items.map((it) => {
              const imgs = parseImages(it.images);
              return (
                <div key={it.id} className="border border-line rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-bold bg-slate-100 rounded px-2 py-0.5">Item {it.seq}</span>
                    {it.brandName && <Badge variant="secondary">{it.brandName}</Badge>}
                    {it.equipmentModel && <Badge variant="outline">{it.equipmentModel}</Badge>}
                    {it.partNumber && (
                      <Link href={`/part-number/${it.partNumber.slug}`}>
                        <Badge className="font-mono">{it.partNumber.number}</Badge>
                      </Link>
                    )}
                    {it.partNumberStr && !it.partNumber && (
                      <Badge className="font-mono">{it.partNumberStr}</Badge>
                    )}
                  </div>
                  <div className="text-sm">
                    {it.productName && <p className="font-bold">{it.productName}</p>}
                    <p className="text-muted text-xs mt-1">
                      数量：{it.quantity} {it.unit}
                    </p>
                    {it.description && <p className="text-muted text-xs mt-1 leading-relaxed">{it.description}</p>}
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

          {/* 供应商报价入口 */}
          <div className="mt-5 pt-5 border-t border-line">
            <Link href={`/rfq/${rfq.id}/quote`}>
              <Button className="bg-accent text-ink hover:bg-[#d49215] w-full sm:w-auto">
                我要报价
              </Button>
            </Link>
          </div>
        </div>

        {/* 报价汇总（仅采购方/管理员/访客可见，供应商已隔离） */}
        {!isSupplier && rfq.quotes.length > 0 && (
          <div className="bg-white border border-line rounded-lg p-5 mb-6">
            <h2 className="text-xl font-bold mb-3">报价汇总</h2>
            <p className="text-xs text-muted mb-3">
              总项目 {rfq.items.length} 项 · 已报价供应商 {quotedSuppliers} 家
            </p>
            <div className="space-y-2">
              {rfq.quotes.map((q) => {
                const hasItems = q.items.length > 0;
                const legacyPrice = !hasItems && q.unitPrice != null ? q.unitPrice : null;
                return (
                  <div key={q.id} className="flex justify-between items-center border border-line rounded-lg px-4 py-2.5 text-sm">
                    <span className="font-bold">{q.supplier.shortName || q.supplier.name}</span>
                    <span className="text-xs">
                      {legacyPrice != null ? (
                        <span className="text-muted">历史总价：{q.currency} {legacyPrice.toLocaleString()}</span>
                      ) : hasItems && q.totalAmount != null ? (
                        <span className="font-bold text-brandGreen">
                          完整报价 {q.quotedCount}/{rfq.items.length} 项 · 总额 {q.items[0]?.currency || "CNY"} {q.totalAmount.toLocaleString()}
                        </span>
                      ) : hasItems && q.quotedCount > 0 ? (
                        <span className="text-amber-600">部分报价：{q.quotedCount}/{rfq.items.length} 项</span>
                      ) : (
                        <span className="text-muted">未报价</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 分项比价表（仅采购方/管理员/访客可见，供应商已隔离） */}
        {!isSupplier && rfq.quotes.length > 0 && (
          <div className="bg-white border border-line rounded-lg p-5 mb-6 overflow-x-auto">
            <h2 className="text-xl font-bold mb-1">分项比价</h2>
            <p className="text-xs text-muted mb-4">
              价格排名按同一明细、同一币种从低到高；不同币种不互相比较。最低价仅为价格第 1 名，不代表“最佳供应商”。
            </p>
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-line">
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
                    <tr key={item.id} className="border-b border-line/50 align-top">
                      <td className="py-2 pr-2 whitespace-nowrap">
                        <span className="text-xs font-bold bg-slate-100 rounded px-1.5 py-0.5">Item {item.seq}</span>
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">{item.partNumberStr || item.partNumber?.number || "—"}</td>
                      <td className="py-2 px-2 text-xs">{item.productName || "—"}</td>
                      <td className="py-2 px-2 whitespace-nowrap text-xs">{item.quantity} {item.unit}</td>
                      {rfq.quotes.map((q) => {
                        const c = row[q.id];
                        if (!c) return <td key={q.id} className="py-2 px-2 text-xs text-muted">—</td>;
                        return (
                          <td key={q.id} className="py-2 px-2 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold">
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

        {/* 报价列表（供应商隔离：供应商仅见自己的报价；采购方/管理员/访客可见全部） */}
        <h2 className="text-xl font-bold mb-4">
          {isSupplier ? "我的报价" : "供应商报价"}（{rfq.quotes.length}）
        </h2>
        {rfq.quotes.length === 0 ? (
          <div className="bg-white border border-line rounded-lg p-8 text-center text-muted">
            {isSupplier ? "您尚未对该询价报价" : "暂无报价"}
          </div>
        ) : (
          <div className="space-y-3">
            {rfq.quotes.map((q) => (
              <div key={q.id} className="bg-white border border-line rounded-lg p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <Link href={`/suppliers/${q.supplier.slug}`} className="font-bold hover:text-accent">
                      {q.supplier.shortName || q.supplier.name}
                      {isSupplier && mySupplierId === q.supplier.id && (
                        <span className="ml-2 text-xs font-normal text-blue-600">（我的报价）</span>
                      )}
                    </Link>
                    {q.remarks && <p className="text-sm text-muted mt-1">{q.remarks}</p>}
                    <div className="flex gap-3 mt-2 text-xs text-muted flex-wrap">
                      <span>报价 {q.quotedCount}/{rfq.items.length} 项</span>
                      {q.totalAmount !== null && q.totalAmount !== undefined && (
                        <span className="font-bold text-brandGreen">
                          总价 {q.items[0]?.currency || "CNY"} {q.totalAmount.toLocaleString()}
                        </span>
                      )}
                      {q.totalAmount === null && q.quotedCount > 0 && (
                        <span className="text-amber-600">部分报价（{q.quotedCount}/{rfq.items.length} 项）</span>
                      )}
                      {q.stockStatus && <span>库存：{q.stockStatus}</span>}
                      {q.warranty && <span>质保：{q.warranty}</span>}
                      {q.paymentTerms && <span>付款：{q.paymentTerms}</span>}
                      {q.incoterm && <span>{q.incoterm}</span>}
                    </div>
                    {/* 分项报价明细 */}
                    {q.items.length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs min-w-[480px]">
                          <thead>
                            <tr className="text-left text-muted border-b border-line">
                              <th className="py-1 pr-2">Item</th>
                              <th className="py-1 px-2">件号</th>
                              <th className="py-1 px-2">配件</th>
                              <th className="py-1 px-2">数量</th>
                              <th className="py-1 px-2">单价</th>
                              <th className="py-1 px-2">交期</th>
                              <th className="py-1 px-2">质量</th>
                            </tr>
                          </thead>
                          <tbody>
                            {q.items.map((qi) => {
                              const item = rfq.items.find((it) => it.id === qi.rfqItemId);
                              return (
                                <tr key={qi.id} className="border-b border-line/50">
                                  <td className="py-1 pr-2">Item {item?.seq ?? "?"}</td>
                                  <td className="py-1 px-2 font-mono">{item?.partNumberStr || item?.partNumber?.number || "—"}</td>
                                  <td className="py-1 px-2">{item?.productName || "—"}</td>
                                  <td className="py-1 px-2">{item?.quantity} {item?.unit}</td>
                                  <td className="py-1 px-2 font-mono">
                                    {qi.unitPrice != null ? `${qi.currency} ${qi.unitPrice.toLocaleString()}` : "—"}
                                  </td>
                                  <td className="py-1 px-2">{qi.leadTime || "—"}</td>
                                  <td className="py-1 px-2">{qi.quality || "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {/* 报价附件 */}
                    {(() => {
                      if (!q.attachments) return null;
                      let atts: string[] = [];
                      try {
                        atts = JSON.parse(q.attachments);
                        if (!Array.isArray(atts)) atts = [];
                      } catch { atts = []; }
                      if (atts.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {atts.map((u) => (
                            <a key={u} href={u} target="_blank"
                              className="text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded px-2 py-1 hover:bg-blue-100">
                              报价附件：{u.split("/").pop()}
                            </a>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
