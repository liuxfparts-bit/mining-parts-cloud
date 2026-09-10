export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updateEquipment } from "../../actions";

export default async function EquipmentEdit({ params }: { params: { id: string } }) {
  const e = await prisma.equipment.findUnique({ where: { id: parseInt(params.id) } });
  if (!e) notFound();
  const f = "border rounded px-3 py-2 text-sm w-full";

  return (
    <div className="p-6 max-w-2xl">
      <a href="/admin/equipment" className="text-sm text-blue-600 hover:underline">← 返回设备列表</a>
      <h1 className="text-2xl font-bold mt-4 mb-6">编辑设备：{e.model}</h1>
      <form action={async (fd) => { "use server"; await updateEquipment(e.id, fd); }} className="bg-white rounded-lg border p-6 space-y-4">
        <div><label className="block text-sm mb-1">型号</label><input name="model" defaultValue={e.model} required className={f} /></div>
        <div><label className="block text-sm mb-1">名称</label><input name="name" defaultValue={e.name} required className={f} /></div>
        <div><label className="block text-sm mb-1">类型</label><input name="equipmentType" defaultValue={e.equipmentType} className={f} /></div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">保存</button>
      </form>
    </div>
  );
}
