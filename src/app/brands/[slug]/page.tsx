import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import EquipmentCard from "@/components/EquipmentCard";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({ params }: { params: { slug: string } }) {
  const brand = await prisma.brand.findUnique({
    where: { slug: params.slug },
    include: {
      equipment: { include: { _count: { select: { partNumbers: true } } } },
      partNumbers: { include: { brand: true, equipment: true }, take: 20 },
    },
  });
  if (!brand) notFound();

  return (
    <div className="container py-[42px]">
      <h1 className="text-3xl font-bold mb-2">{brand.name}</h1>
      <p className="text-muted mb-8">{brand.nameEn} · {brand.country}</p>

      <h2 className="text-xl font-bold mb-4">设备型号（{brand.equipment.length}）</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] mb-10">
        {brand.equipment.map((e) => (
          <EquipmentCard key={e.id} slug={e.slug} brandName={brand.name} model={e.model} equipmentType={e.equipmentType} description={e.description} partCount={e._count.partNumbers} />
        ))}
      </div>

      <h2 className="text-xl font-bold mb-4">件号（{brand.partNumbers.length}）</h2>
      <div className="bg-white border border-line rounded-lg overflow-hidden">
        {brand.partNumbers.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-4 border-b border-line last:border-0">
            <div>
              <Link href={`/part-number/${p.slug}`} className="font-mono font-bold text-accent hover:underline">{p.number}</Link>
              <p className="text-sm text-muted">{p.name}</p>
            </div>
            {p.equipment && <span className="text-xs text-muted">{p.equipment.model}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
