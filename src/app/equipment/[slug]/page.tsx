import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PartNumberCard from "@/components/PartNumberCard";
import SupplierCard from "@/components/SupplierCard";
import RFQCard from "@/components/RFQCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const eq = await prisma.equipment.findUnique({
    where: { slug: params.slug },
    include: { brand: true, _count: { select: { partNumbers: true } } },
  });
  if (!eq || eq.status !== "ACTIVE") return { title: "Equipment Not Found" };

  return {
    title: `${eq.brand.name} ${eq.model} ${eq.name} | Mining Parts Cloud`,
    description: `${eq._count.partNumbers} spare parts for ${eq.brand.name} ${eq.model} (${eq.equipmentType}). Find suppliers, prices and submit RFQs.`,
  };
}

export default async function EquipmentDetailPage({ params }: { params: { slug: string } }) {
  const equipment = await prisma.equipment.findUnique({
    where: { slug: params.slug },
    include: {
      brand: true,
      partNumbers: {
        include: { products: { include: { supplier: true } }, brand: true, equipment: true },
        orderBy: { number: "asc" },
      },
      rfqs: { take: 3, orderBy: { createdAt: "desc" } },
    },
  });
  if (!equipment || equipment.status !== "ACTIVE") notFound();

  // 汇总供应商
  const supplierMap = new Map<number, { name: string; slug: string; productCount: number; verified: boolean; province: string | null }>();
  for (const pn of equipment.partNumbers) {
    for (const prod of pn.products) {
      const s = prod.supplier;
      const existing = supplierMap.get(s.id);
      if (existing) existing.productCount++;
      else supplierMap.set(s.id, { name: s.shortName || s.name, slug: s.slug, productCount: 1, verified: s.verifiedStatus === "VERIFIED", province: s.province });
    }
  }
  const suppliers = Array.from(supplierMap.values()).sort((a, b) => b.productCount - a.productCount);

  return (
    <div className="container py-[42px]">
      {/* 面包屑 */}
      <div className="text-sm text-muted mb-6">
        <Link href="/" className="hover:text-accent">首页</Link> / <Link href="/equipment" className="hover:text-accent">找设备</Link> /{" "}
        <span className="text-ink">{equipment.brand.name} {equipment.model}</span>
      </div>

      {/* 设备介绍 */}
      <div className="bg-white border border-line rounded-lg p-8 mb-8">
        <div className="flex items-start gap-6 flex-wrap">
          <div className="w-40 h-40 bg-gradient-to-br from-[#35444c] to-[#17222a] rounded-lg flex items-center justify-center text-white font-bold text-center p-4 shrink-0 overflow-hidden relative">
            {equipment.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={equipment.imageUrl} alt={equipment.model} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span>{equipment.brand.name}<br />{equipment.model}</span>
            )}
          </div>
          <div className="flex-1 min-w-[300px]">
            <h1 className="text-3xl font-bold mb-2">{equipment.name}</h1>
            <p className="text-muted mb-3">
              <Link href={`/brands/${equipment.brand.slug}`} className="hover:text-accent">{equipment.brand.name}</Link>
              {" · "}{equipment.brand.nameEn}
            </p>
            <div className="flex gap-2 flex-wrap mb-3">
              <Badge variant="secondary">{equipment.equipmentType}</Badge>
              {equipment.series && <Badge variant="outline">{equipment.series}</Badge>}
              {equipment.mineType && <Badge variant="outline">{equipment.mineType}</Badge>}
            </div>
            {equipment.description && <p className="text-muted">{equipment.description}</p>}
          </div>
        </div>

        {/* 设备参数表 */}
        <h3 className="text-lg font-bold mt-8 mb-4">设备参数</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-line pt-5">
          <div><span className="text-muted">制造商：</span>{equipment.manufacturer || equipment.brand.name}</div>
          <div><span className="text-muted">型号：</span>{equipment.model}</div>
          {equipment.series && <div><span className="text-muted">系列：</span>{equipment.series}</div>}
          {equipment.productionYear && <div><span className="text-muted">生产年份：</span>{equipment.productionYear}</div>}
          {equipment.mineType && <div><span className="text-muted">矿山类型：</span>{equipment.mineType}</div>}
          {equipment.application && <div><span className="text-muted">应用：</span>{equipment.application}</div>}
          <div><span className="text-muted">设备类型：</span>{equipment.equipmentType}</div>
        </div>
      </div>

      {/* 相关件号 */}
      <h2 className="text-2xl font-bold mb-4">相关件号（{equipment.partNumbers.length}）</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px] mb-10">
        {equipment.partNumbers.map((p) => {
          const prices = p.products.map((pr) => pr.price).filter((v): v is number => v !== null);
          return (
            <PartNumberCard
              key={p.id}
              slug={p.slug}
              partNumber={p.number}
              name={p.name}
              category={p.category}
              brandName={p.brand?.name}
              equipmentModel={p.equipment?.model}
              supplierCount={p.products.length}
              minPrice={prices.length > 0 ? Math.min(...prices) : null}
            />
          );
        })}
      </div>

      {/* 相关供应商 */}
      <h2 className="text-2xl font-bold mb-4">供应该设备配件的厂家（{suppliers.length}）</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] mb-10">
        {suppliers.map((s, i) => (
          <SupplierCard
            key={i}
            slug={s.slug}
            name={s.name}
            province={s.province}
            mainBusiness={`${s.productCount} 个相关产品`}
            verified={s.verified}
            productCount={s.productCount}
          />
        ))}
      </div>

      {/* 最新询价 */}
      {equipment.rfqs.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mb-4">最新询价</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
            {equipment.rfqs.map((r) => (
              <RFQCard
                key={r.id}
                id={r.id}
                title={r.title}
                partNumberStr={r.partNumberStr || null}
                brandName={r.brandName}
                quantity={r.quantity}
                region={r.region}
                status={r.status}
                createdAt={r.createdAt}
              />
            ))}
          </div>
        </>
      )}

      {/* 询价按钮 */}
      <div className="mt-10 bg-accent/5 border border-accent/20 rounded-lg p-6 text-center">
        <h3 className="text-lg font-bold mb-2">找不到需要的配件？</h3>
        <p className="text-sm text-muted mb-4">发布询价，让供应商主动联系你</p>
        <Link href="/rfq/create">
          <Button size="lg" className="bg-accent text-ink hover:bg-[#d49215]">发布设备询价</Button>
        </Link>
      </div>
    </div>
  );
}
