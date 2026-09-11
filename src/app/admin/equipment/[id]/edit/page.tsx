export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EditEquipmentForm from "./EditEquipmentForm";

export default async function EquipmentEdit({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [e, brands] = await Promise.all([
    prisma.equipment.findUnique({ where: { id } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!e) notFound();
  return (
    <div className="p-6 max-w-3xl">
      <a href="/admin/equipment" className="text-sm text-blue-600">← 返回设备列表</a>
      <h1 className="text-2xl font-bold mt-4 mb-6">编辑设备：{e.model}</h1>
      <EditEquipmentForm id={e.id} brands={brands.map((b) => ({ id: b.id, name: b.name, nameEn: b.nameEn }))} initial={e} />
    </div>
  );
}
