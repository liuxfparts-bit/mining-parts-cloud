import { prisma } from "@/lib/prisma";

export default async function AdminEquipmentPage() {
  const items = await prisma.equipment.findMany({
    include: { brand: true, _count: { select: { partNumbers: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">设备管理</h1>
        <span className="text-sm text-gray-500">共 {items.length} 台设备</span>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">品牌</th>
              <th className="text-left p-3">型号</th>
              <th className="text-left p-3">类型</th>
              <th className="text-left p-3">件号数</th>
              <th className="text-left p-3">状态</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{e.id}</td>
                <td className="p-3">{e.brand.name}</td>
                <td className="p-3 font-medium">
                  <a href={`/equipment/${e.slug}`} className="text-blue-600 hover:underline">{e.model}</a>
                </td>
                <td className="p-3">{e.equipmentType}</td>
                <td className="p-3">{e._count.partNumbers}</td>
                <td className="p-3"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
