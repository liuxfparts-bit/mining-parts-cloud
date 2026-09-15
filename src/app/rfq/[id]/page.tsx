import Link from "next/link";
import { prisma } from "@/lib/db";
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

  const rfq = await prisma.rFQ.findUnique({
    where: { id },
    include: {
      partNumber: { include: { brand: true, equipment: true } },
      items: { include: { partNumber: true }, orderBy: { seq: "asc" } },
      quotes: { include: { supplier: true } },
    },
  });
  if (!rfq) notFound();

  const st = statusMap[rfq.status] || statusMap.COLLECTING;

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

        {/* 报价列表（兼容旧总报价；分项比价在后续阶段升级） */}
        <h2 className="text-xl font-bold mb-4">供应商报价（{rfq.quotes.length}）</h2>
        {rfq.quotes.length === 0 ? (
          <div className="bg-white border border-line rounded-lg p-8 text-center text-muted">暂无报价</div>
        ) : (
          <div className="space-y-3">
            {rfq.quotes.map((q) => (
              <div key={q.id} className="bg-white border border-line rounded-lg p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <Link href={`/suppliers/${q.supplier.slug}`} className="font-bold hover:text-accent">
                      {q.supplier.shortName || q.supplier.name}
                    </Link>
                    {q.remarks && <p className="text-sm text-muted mt-1">{q.remarks}</p>}
                    <div className="flex gap-3 mt-2 text-xs text-muted flex-wrap">
                      {q.stockStatus && <span>库存：{q.stockStatus}</span>}
                      {q.warranty && <span>质保：{q.warranty}</span>}
                      {q.paymentTerms && <span>付款：{q.paymentTerms}</span>}
                      {q.incoterm && <span>{q.incoterm}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {q.unitPrice !== null && q.unitPrice !== undefined && (
                      <p className="text-xl font-bold text-green">{q.currency} {q.unitPrice.toLocaleString()}</p>
                    )}
                    {q.leadTime && <p className="text-xs text-muted">{q.leadTime}</p>}
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
