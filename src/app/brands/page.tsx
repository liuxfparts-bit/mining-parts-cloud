import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const brands = await prisma.brand.findMany({
    include: { _count: { select: { equipment: true, partNumbers: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="container py-[42px]">
      <h1 className="text-3xl font-bold mb-2">品牌库</h1>
      <p className="text-muted mb-8">按品牌浏览设备和件号</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
        {brands.map((b) => (
          <Link key={b.id} href={`/brands/${b.slug}`} className="bg-white border border-line p-6 rounded-lg hover:shadow-md text-center">
            <div className="text-2xl font-black mb-2">{b.name}</div>
            <p className="text-xs text-muted">{b.country}</p>
            <p className="text-xs text-muted mt-2">设备 {b._count.equipment} · 件号 {b._count.partNumbers}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
