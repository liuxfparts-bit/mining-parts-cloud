import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Search, Package, Wrench, Building2, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim() || "";

  if (!q) {
    return (
      <div className="container py-[42px]">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Search className="h-6 w-6 text-accent" /> 搜索
        </h1>
        <p className="text-muted">请输入搜索关键词</p>
      </div>
    );
  }

  // 精确匹配件号 → 直接跳转件号详情页
  const exactPart = await prisma.partNumber.findUnique({
    where: { number: q.toUpperCase() },
    select: { slug: true },
  });
  if (exactPart) {
    redirect(`/part-number/${exactPart.slug}`);
  }

  const [partNumbers, equipment, brands, suppliers] = await Promise.all([
    prisma.partNumber.findMany({
      where: {
        OR: [
          { number: { contains: q } },
          { name: { contains: q } },
          { nameEn: { contains: q } },
          { category: { contains: q } },
        ],
      },
      include: {
        brand: true,
        equipment: { include: { brand: true } },
        products: { include: { supplier: true } },
      },
      take: 15,
    }),
    prisma.equipment.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { model: { contains: q } },
          { name: { contains: q } },
          { equipmentType: { contains: q } },
          { brand: { name: { contains: q } } },
        ],
      },
      include: { brand: true, _count: { select: { partNumbers: true } } },
      take: 10,
    }),
    prisma.brand.findMany({
      where: { OR: [{ name: { contains: q } }, { nameEn: { contains: q } }] },
      take: 5,
    }),
    prisma.supplier.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { shortName: { contains: q } },
          { mainBusiness: { contains: q } },
        ],
      },
      take: 10,
    }),
  ]);

  const total = partNumbers.length + equipment.length + brands.length + suppliers.length;

  return (
    <div className="container py-[42px]">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Search className="h-6 w-6 text-accent" />
        搜索：<span className="text-accent">"{q}"</span>
      </h1>
      <p className="text-muted mb-8">找到 {total} 条结果</p>

      {partNumbers.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Tag className="h-5 w-5 text-accent" /> 件号（{partNumbers.length}）
          </h2>
          <div className="bg-white border border-line rounded-lg overflow-hidden">
            {partNumbers.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4 border-b border-line last:border-0">
                <div>
                  <Link href={`/part-number/${p.slug}`} className="font-mono font-bold text-accent hover:underline">
                    {p.number}
                  </Link>
                  <p className="text-sm text-muted">{p.name} {p.equipment && `· ${p.brand?.name} ${p.equipment.model}`}</p>
                </div>
                <Link href={`/part-number/${p.slug}`} className="text-sm text-accent hover:underline ml-4">查看 →</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {equipment.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-accent" /> 设备（{equipment.length}）
          </h2>
          <div className="bg-white border border-line rounded-lg overflow-hidden">
            {equipment.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-4 border-b border-line last:border-0">
                <div>
                  <Link href={`/equipment/${e.slug}`} className="font-bold hover:text-accent">
                    {e.brand.name} {e.model}
                  </Link>
                  <p className="text-sm text-muted">{e.equipmentType} · {e._count.partNumbers} 个件号</p>
                </div>
                <Link href={`/equipment/${e.slug}`} className="text-sm text-accent hover:underline ml-4">查看 →</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {brands.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Package className="h-5 w-5 text-accent" /> 品牌（{brands.length}）
          </h2>
          <div className="flex gap-2 flex-wrap">
            {brands.map((b) => (
              <Link key={b.id} href={`/brands/${b.slug}`} className="bg-white border border-line px-4 py-2 rounded-lg hover:shadow-md">
                {b.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {suppliers.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-accent" /> 供应商（{suppliers.length}）
          </h2>
          <div className="bg-white border border-line rounded-lg overflow-hidden">
            {suppliers.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4 border-b border-line last:border-0">
                <div>
                  <Link href={`/suppliers/${s.slug}`} className="font-bold hover:text-accent">
                    {s.shortName || s.name}
                  </Link>
                  <p className="text-sm text-muted">{s.province || ""} · {s.mainBusiness.slice(0, 40)}</p>
                </div>
                <Link href={`/suppliers/${s.slug}`} className="text-sm text-accent hover:underline ml-4">查看 →</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {total === 0 && (
        <div className="bg-white border border-line rounded-lg p-12 text-center">
          <p className="text-muted mb-4">未找到相关结果</p>
          <Link href="/rfq/create" className="text-accent hover:underline">发布询价 →</Link>
        </div>
      )}
    </div>
  );
}
