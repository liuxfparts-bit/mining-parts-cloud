import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Send, Store, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { partNumber: string };
}): Promise<Metadata> {
  const pn = await prisma.partNumber.findUnique({
    where: { slug: params.partNumber },
    include: { brand: true, equipment: true },
  });
  if (!pn) return { title: "Part Not Found" };
  const title = pn.seoTitle || `${pn.number} ${pn.name} | ${pn.brand?.name || ""} ${pn.equipment?.model || ""} | 矿配云`;
  const description = pn.seoDescription || `Find ${pn.number} (${pn.name}) for ${pn.brand?.name || ""} ${pn.equipment?.model || ""}. Compare suppliers, prices, stock, lead time and warranty.`;
  return { title, description };
}

const TYPE_LABEL: Record<string, string> = {
  OEM: "OEM 原厂", Replacement: "替代件", Aftermarket: "售后件", Used: "二手", Reconditioned: "再制造",
};

export default async function PartNumberDetailPage({
  params,
}: {
  params: { partNumber: string };
}) {
  const pn = await prisma.partNumber.findUnique({
    where: { slug: params.partNumber },
    include: {
      brand: true,
      equipment: { include: { brand: true } },
      products: {
        include: { supplier: true },
        orderBy: { price: "asc" },
      },
      _count: { select: { rfqs: true } },
    },
  });
  if (!pn) notFound();

  const supplierCount = new Set(pn.products.map((p) => p.supplierId)).size;

  const relatedParts = await prisma.partNumber.findMany({
    where: {
      id: { not: pn.id },
      OR: [
        { equipmentId: pn.equipmentId || -1 },
        { AND: [{ brandId: pn.brandId || -1 }, { category: pn.category }] },
      ],
    },
    take: 8,
    orderBy: { id: "asc" },
  });

  return (
    <div className="container py-6">
      {/* 面包屑 */}
      <div className="text-xs text-muted mb-3">
        <Link href="/" className="hover:text-accent">首页</Link> /
        <Link href="/part-number" className="hover:text-accent ml-1">找配件</Link> /
        <span className="ml-1">{pn.category || "配件"}</span> /
        {pn.equipment && <Link href={`/equipment/${pn.equipment.slug}`} className="hover:text-accent ml-1">{pn.brand?.name} {pn.equipment.model}</Link>} /
        <span className="ml-1 font-mono font-medium text-ink">{pn.number}</span>
      </div>

      {/* 件号主信息 */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-3xl font-bold text-accent">{pn.number}</h1>
            <p className="text-lg font-medium mt-1">{pn.name} {pn.nameEn && <span className="text-muted">· {pn.nameEn}</span>}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {pn.brand && <Badge>{pn.brand.name}</Badge>}
              {pn.equipment && <Badge variant="outline">适配：{pn.equipment.model}</Badge>}
              <Badge variant="secondary">{pn.category || "配件"}</Badge>
              {pn.verified ? (
                <span className="inline-flex items-center gap-1 text-xs text-green"><CheckCircle2 size={13}/> 已验证</span>
              ) : (
                <span className="text-xs text-muted">待验证</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="flex gap-5 text-sm">
              <div><div className="text-2xl font-bold text-accent">{supplierCount}</div><div className="text-xs text-muted">家供应商</div></div>
              <div><div className="text-2xl font-bold text-accent">{pn.products.length}</div><div className="text-xs text-muted">个产品</div></div>
              <div><div className="text-2xl font-bold text-accent">{pn._count.rfqs}</div><div className="text-xs text-muted">条询价</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* 供应商产品 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">可供货产品（{pn.products.length}）</h2>
        {pn.products.length > 0 && (
          <Link href={`/rfq/create?partNumber=${pn.number}`}>
            <Button className="bg-accent text-ink hover:bg-[#d49215] flex items-center gap-1 text-sm">
              <Send size={14} /> 询价全部供应商
            </Button>
          </Link>
        )}
      </div>

      {pn.products.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-muted">
          暂无供应商提供该件号，<Link href="/rfq/create" className="text-accent">发布询价</Link>找货
        </div>
      ) : (
        <>
          {/* 比较表 */}
          <div className="bg-white border rounded-lg overflow-x-auto mb-4 hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-2">供应商</th>
                  <th className="text-left p-2">类型</th>
                  <th className="text-left p-2">价格</th>
                  <th className="text-left p-2">库存</th>
                  <th className="text-left p-2">交期</th>
                  <th className="text-left p-2">质保</th>
                  <th className="text-left p-2">认证</th>
                </tr>
              </thead>
              <tbody>
                {pn.products.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-2">{p.supplier.shortName || p.supplier.name}</td>
                    <td className="p-2">{TYPE_LABEL[p.productType] || p.productType}</td>
                    <td className="p-2 font-bold text-green">{p.price ? `¥${p.price.toLocaleString()}` : "询价"}</td>
                    <td className="p-2">{p.stockStatus === "IN_STOCK" ? `现货 ${p.stock || ""}` : p.stockStatus}</td>
                    <td className="p-2">{p.leadTime || "-"}</td>
                    <td className="p-2">{p.warranty || "-"}</td>
                    <td className="p-2">{p.supplier.verifiedStatus === "VERIFIED" ? <span className="text-green">✓ 已认证</span> : p.supplier.verifiedStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 产品卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pn.products.map((prod) => (
              <div key={prod.id} className="bg-white border rounded-lg p-4">
                {prod.images ? (
                  <img src={prod.images.split(",")[0]} className="w-full h-36 object-cover rounded mb-3 bg-gray-50" />
                ) : (
                  <div className="w-full h-36 rounded mb-3 bg-gray-100 flex items-center justify-center text-gray-300 text-sm">无图片</div>
                )}
                <div className="text-xs text-muted mb-1">Part No. <span className="font-mono font-medium text-ink">{pn.number}</span></div>
                <h3 className="font-medium">{prod.name}</h3>
                <div className="flex items-center gap-1 mt-1 text-sm">
                  <Store size={13} className="text-muted" />
                  <Link href={`/suppliers/${prod.supplier.slug}`} className="text-accent hover:underline">
                    {prod.supplier.shortName || prod.supplier.name}
                  </Link>
                  {prod.supplier.verifiedStatus === "VERIFIED" && <span className="text-xs text-green">✓</span>}
                </div>
                <div className="flex items-baseline gap-2 mt-3">
                  {prod.price ? <span className="text-xl font-bold text-green">¥{prod.price.toLocaleString()}</span> : <span className="text-sm text-muted">询价</span>}
                  {prod.leadTime && <span className="text-xs text-muted">{prod.leadTime}</span>}
                </div>
                <div className="flex gap-2 mt-1 text-xs text-muted">
                  {prod.stockStatus === "IN_STOCK" && <span className="text-green">现货</span>}
                  {prod.warranty && <span>质保 {prod.warranty}</span>}
                </div>
                <div className="flex gap-2 mt-3">
                  <Link href={`/suppliers/${prod.supplier.slug}`} className="flex-1 text-center border rounded py-1.5 text-sm hover:bg-gray-50">查看供应商</Link>
                  <Link
                    href={`/rfq/create?partNumber=${pn.number}&supplierId=${prod.supplierId}`}
                    className="flex-1 text-center bg-accent text-ink rounded py-1.5 text-sm hover:bg-[#d49215] font-medium"
                  >
                    立即询价
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 相关件号 */}
      {relatedParts.length > 0 && (
        <>
          <h2 className="text-lg font-bold mt-8 mb-3">相关件号</h2>
          <div className="flex flex-wrap gap-2">
            {relatedParts.map((rp) => (
              <Link key={rp.id} href={`/part-number/${rp.slug}`}
                className="bg-white border px-3 py-2 rounded text-sm font-mono hover:shadow">
                {rp.number} <span className="text-muted font-sans ml-1">{rp.name}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
