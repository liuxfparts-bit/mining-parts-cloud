import Link from "next/link";
import { prisma } from "@/lib/db";
import EquipmentCard from "@/components/EquipmentCard";
import PartNumberCard from "@/components/PartNumberCard";
import SupplierCard from "@/components/SupplierCard";
import RFQCard from "@/components/RFQCard";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [brands, equipment, partNumbers, suppliers, recentRFQs] = await Promise.all([
    prisma.brand.findMany({ include: { _count: { select: { equipment: true, partNumbers: true } } }, take: 8, orderBy: { name: "asc" } }),
    prisma.equipment.findMany({ include: { brand: true, _count: { select: { partNumbers: true } } }, take: 8, orderBy: { id: "asc" } }),
    prisma.partNumber.findMany({
      include: { brand: true, equipment: { include: { brand: true } }, products: { include: { supplier: true } } },
      take: 6,
      orderBy: { id: "asc" },
    }),
    prisma.supplier.findMany({ include: { _count: { select: { products: true } } }, take: 4, orderBy: { id: "asc" } }),
    prisma.rFQ.findMany({ take: 4, orderBy: { createdAt: "desc" }, include: { partNumber: true } }),
  ]);

  return (
    <>
      {/* Hero — 搜索为核心 */}
      <section className="bg-gradient-to-br from-dark via-[#1a2d3a] to-[#243a48] text-white py-[64px] md:py-[80px]">
        <div className="container text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight">
            找设备 · 找配件 · 找厂家 · 发询价
          </h1>
          <p className="text-[#9fb2bf] text-sm md:text-base mb-8">
            Find Equipment · Find Parts · Find Suppliers · Post RFQs
          </p>

          {/* 大搜索框 */}
          <div className="max-w-[860px] mx-auto">
            <form action="/search" className="flex items-center bg-white rounded-lg shadow-2xl overflow-hidden">
              <div className="flex-1 flex items-center">
                <input
                  type="text"
                  name="q"
                  placeholder="输入品牌、设备型号、配件件号或产品名称"
                  className="w-full px-5 py-4 text-base text-ink outline-none"
                />
              </div>
              <button
                type="submit"
                className="bg-accent text-ink font-bold px-8 py-4 hover:bg-[#d49215] transition-colors whitespace-nowrap"
              >
                搜索
              </button>
            </form>
            <div className="flex flex-wrap justify-center gap-2 mt-4 text-xs">
              <span className="text-[#9fb2bf]">热门搜索：</span>
              <Link href="/search?q=Sandvik MB670" className="text-[#c5d8e0] hover:text-accent">Sandvik MB670</Link>
              <span className="text-[#4a5a66]">|</span>
              <Link href="/search?q=Sandvik LS190" className="text-[#c5d8e0] hover:text-accent">Sandvik LS190</Link>
              <span className="text-[#4a5a66]">|</span>
              <Link href="/search?q=CAT CL210" className="text-[#c5d8e0] hover:text-accent">CAT CL210</Link>
              <span className="text-[#4a5a66]">|</span>
              <Link href="/search?q=JOY 10SC32" className="text-[#c5d8e0] hover:text-accent">JOY 10SC32</Link>
              <span className="text-[#4a5a66]">|</span>
              <Link href="/search?q=XP210162" className="text-[#c5d8e0] hover:text-accent">XP210162</Link>
            </div>
          </div>
        </div>
      </section>

      <main className="container">
        {/* 热门品牌 */}
        <section className="py-[42px]">
          <div className="flex justify-between items-end mb-5">
            <h2 className="text-2xl font-bold">热门品牌</h2>
            <Link href="/brands" className="text-[13px] text-[#8a6a27] flex items-center gap-1">全部品牌 <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-[14px]">
            {brands.map((b) => (
              <Link key={b.id} href={`/brands/${b.slug}`} className="bg-white border border-line p-5 text-center rounded-lg font-bold hover:shadow-md">
                {b.name}
                <small className="block text-muted font-normal mt-2 text-[11px]">
                  设备 {b._count.equipment} · 件号 {b._count.partNumbers}
                </small>
              </Link>
            ))}
          </div>
        </section>

        {/* 热门设备 */}
        <section className="py-[42px]">
          <div className="flex justify-between items-end mb-5">
            <h2 className="text-2xl font-bold">热门矿山设备</h2>
            <Link href="/equipment" className="text-[13px] text-[#8a6a27]">全部设备 →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
            {equipment.map((e) => (
              <EquipmentCard key={e.id} slug={e.slug} brandName={e.brand.name} model={e.model} equipmentType={e.equipmentType} description={e.description} partCount={e._count.partNumbers} />
            ))}
          </div>
        </section>

        {/* 热门件号 */}
        <section className="py-[42px]">
          <div className="flex justify-between items-end mb-5">
            <h2 className="text-2xl font-bold">热门件号</h2>
            <Link href="/part-number" className="text-[13px] text-[#8a6a27]">件号数据库 →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
            {partNumbers.map((p) => {
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
        </section>

        {/* 最新询价 */}
        <section className="py-[42px]">
          <div className="flex justify-between items-end mb-5">
            <h2 className="text-2xl font-bold">最新采购需求</h2>
            <Link href="/rfq/create" className="text-[13px] text-[#8a6a27]">发布需求 →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
            {recentRFQs.map((r) => (
              <RFQCard key={r.id} id={r.id} title={r.title} partNumberStr={r.partNumberStr || r.partNumber?.number} brandName={r.brandName} quantity={r.quantity} region={r.region} status={r.status} createdAt={r.createdAt} />
            ))}
          </div>
        </section>

        {/* 优选供应商 */}
        <section className="py-[42px]">
          <div className="flex justify-between items-end mb-5">
            <h2 className="text-2xl font-bold">优选供应商</h2>
            <Link href="/suppliers" className="text-[13px] text-[#8a6a27]">全部厂家 →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
            {suppliers.map((s) => (
              <SupplierCard key={s.id} slug={s.slug} name={s.name} shortName={s.shortName} province={s.province} mainBusiness={s.mainBusiness} verified={s.verifiedStatus === "VERIFIED"} productCount={s._count.products} memberLevel={s.memberLevel} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
