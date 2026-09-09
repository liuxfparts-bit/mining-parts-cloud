import Link from "next/link";
import { prisma } from "@/lib/db";
import EquipmentCard from "@/components/EquipmentCard";

export const dynamic = "force-dynamic";

export default async function EquipmentListPage() {
  const equipment = await prisma.equipment.findMany({
    include: { brand: true, _count: { select: { partNumbers: true } } },
    orderBy: { id: "asc" },
  });

  return (
    <div className="container py-[42px]">
      <h1 className="text-3xl font-bold mb-2">找设备</h1>
      <p className="text-muted mb-8">按品牌浏览矿山设备型号，点击查看关联件号</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
        {equipment.map((e) => (
          <EquipmentCard key={e.id} slug={e.slug} brandName={e.brand.name} model={e.model} equipmentType={e.equipmentType} description={e.description} partCount={e._count.partNumbers} />
        ))}
      </div>
    </div>
  );
}
