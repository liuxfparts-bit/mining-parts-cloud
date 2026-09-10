import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { CheckCircle2, MessageSquare, Send } from "lucide-react";

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

  const title = pn.seoTitle || `${pn.number} ${pn.name} for ${pn.brand?.name || ""} ${pn.equipment?.model || ""} | Mining Parts Cloud`;
  const description = pn.seoDescription || `Find ${pn.number} (${pn.name}/${pn.nameEn || ""}) spare parts for ${pn.brand?.name || ""} ${pn.equipment?.model || ""} from verified mining equipment suppliers.`;

  return { title, description };
}

export default async function PartNumberDetailPage({
  params,
}: {
  params: { partNumber: string };
}) {
  // partNumber 参数是 slug，按 slug 查询
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

  // 相关件号（同设备或同品牌同分类）
  const relatedParts = await prisma.partNumber.findMany({
    where: {
      id: { not: pn.id },
      OR: [
        { equipmentId: pn.equipmentId || -1 },
        { AND: [{ brandId: pn.brandId || -1 }, { category: pn.category }] },
      ],
    },
    take: 6,
    orderBy: { id: "asc" },
  });

  return (
    <div className="container py-[42px]">
      <div className="text-sm text-muted mb-6">
        <Link href="/" className="hover:text-accent">首页</Link> /{" "}
        <Link href="/part-number" className="hover:text-accent">件号</Link> /{" "}
        <span className="text-ink font-mono">{pn.number}</span>
      </div>

      {/* 件号信息 */}
      <div className="bg-white border border-line rounded-lg p-8 mb-8">
        <h1 className="font-mono text-3xl font-bold text-accent mb-3">{pn.number}</h1>
        <p className="text-xl font-bold mb-3">{pn.name} {pn.nameEn && `· ${pn.nameEn}`}</p>
        <div className="flex gap-2 flex-wrap mb-4">
          <Badge variant="secondary">{pn.category}</Badge>
          {pn.brand && (
            <Link href={`/brands/${pn.brand.slug}`}><Badge>{pn.brand.name}</Badge></Link>
          )}
          {pn.equipment && (
            <Link href={`/equipment/${pn.equipment.slug}`}>
              <Badge variant="outline">适配：{pn.brand?.name} {pn.equipment.model}</Badge>
            </Link>
          )}
        </div>
        {pn.description && <p className="text-muted">{pn.description}</p>}

        {/* 统计数据 */}
        <div className="flex gap-8 mt-5 pt-5 border-t border-line text-sm">
          <div>
            <span className="text-2xl font-bold text-accent">{supplierCount}</span>
            <span className="text-muted ml-1">家供应商</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-accent">{pn.products.length}</span>
            <span className="text-muted ml-1">个产品</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-accent">{pn._count.rfqs}</span>
            <span className="text-muted ml-1">条询价</span>
          </div>
        </div>

        {/* 扩展属性 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-line text-sm">
          <div><span className="text-muted">验证状态：</span>{pn.verified ? <span className="text-green">✓ 已验证</span> : "待验证"}</div>
          <div><span className="text-muted">OEM 状态：</span>{pn.oemStatus === "OEM" ? "原厂 OEM" : "售后替代"}</div>
          {pn.material && <div><span className="text-muted">材质：</span>{pn.material}</div>}
          {pn.specification && <div><span className="text-muted">规格：</span>{pn.specification}</div>}
          {pn.application && <div><span className="text-muted">应用：</span>{pn.application}</div>}
          {pn.oldPartNumber && <div><span className="text-muted">旧件号：</span>{pn.oldPartNumber}</div>}
          {pn.alternativePartNumber && <div><span className="text-muted">替代件号：</span>{pn.alternativePartNumber}</div>}
        </div>
      </div>

      {/* 供应商产品列表 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">可供货产品（{pn.products.length}）</h2>
        {pn.products.length > 0 && (
          <Link href={`/rfq/create?partNumber=${pn.number}`}>
            <Button className="bg-accent text-ink hover:bg-[#d49215] flex items-center gap-1">
              <Send size={15} /> 询价全部供应商
            </Button>
          </Link>
        )}
      </div>
      {pn.products.length === 0 ? (
        <div className="bg-white border border-line rounded-lg p-8 text-center">
          <p className="text-muted mb-4">暂无供应商提供该件号</p>
          <Link href="/rfq/create"><Button>发布询价找货</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
          {pn.products.map((prod) => (
            <ProductCard
              key={prod.id}
              id={prod.id}
              partNumber={pn.number}
              productName={prod.name}
              supplierName={prod.supplier.shortName || prod.supplier.name}
              supplierSlug={prod.supplier.slug}
              price={prod.price}
              productType={prod.productType}
              leadTime={prod.leadTime}
              stock={prod.stock}
              stockStatus={prod.stockStatus}
              warranty={prod.warranty}
              moq={prod.moq}
              image={prod.images ? prod.images.split(",")[0] : null}
            />
          ))}
        </div>
      )}

      {/* 相关件号 */}
      {relatedParts.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mt-10 mb-4">相关件号</h2>
          <div className="flex flex-wrap gap-3">
            {relatedParts.map((rp) => (
              <Link
                key={rp.id}
                href={`/part-number/${rp.slug}`}
                className="bg-white border border-line px-4 py-2 rounded-md hover:shadow-md transition-shadow text-sm font-mono"
              >
                {rp.number}
                <span className="text-muted ml-2 font-sans">{rp.name}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
