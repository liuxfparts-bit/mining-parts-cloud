export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { createEquipment } from "../actions";

export default async function AdminEquipmentPage() {
  const items = await prisma.equipment.findMany({
    include: { brand: true, _count: { select: { partNumbers: true } } },
    orderBy: { createdAt: "desc" },
  });
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">设备管理</h1>
        <span className="text-sm text-gray-500">共 {items.length} 台</span>
      </div>

      <form action={createEquipment} className="bg-white rounded-lg border p-4 mb-4 flex gap-2 items-end flex-wrap">
        <select name="brandId" required className="border rounded px-3 py-2 text-sm">
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input name="model" placeholder="型号 (如 MB670-1)" required className="border rounded px-3 py-2 text-sm" />
        <input name="name" placeholder="设备名" required className="border rounded px-3 py-2 text-sm" />
        <input name="equipmentType" placeholder="类型 (如 Bolter Miner)" required className="border rounded px-3 py-2 text-sm" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">新增设备</button>
      </form>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">品牌</th>
              <th className="text-left p-3">型号</th>
              <th className="text-left p-3">类型</th>
              <th className="text-left p-3">件号数</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{e.brand.name}</td>
                <td className="p-3 font-medium">{e.model}</td>
                <td className="p-3">{e.equipmentType}</td>
                <td className="p-3">{e._count.partNumbers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
