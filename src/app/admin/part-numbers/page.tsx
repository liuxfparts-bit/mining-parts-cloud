export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";

export default async function AdminPartNumbersPage() {
  const items = await prisma.partNumber.findMany({
    include: { brand: true, equipment: true, _count: { select: { products: true, rfqs: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">件号管理</h1>
        <span className="text-sm text-gray-500">共 {items.length} 条</span>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">件号</th>
              <th className="text-left p-3">名称</th>
              <th className="text-left p-3">品牌</th>
              <th className="text-left p-3">设备</th>
              <th className="text-left p-3">产品数</th>
              <th className="text-left p-3">已验证</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono font-medium">
                  <a href={`/part-number/${p.number}`} className="text-blue-600 hover:underline">{p.number}</a>
                </td>
                <td className="p-3">{p.name}</td>
                <td className="p-3">{p.brand?.name || "-"}</td>
                <td className="p-3">{p.equipment?.model || "-"}</td>
                <td className="p-3">{p._count.products}</td>
                <td className="p-3">{p.verified ? "✓" : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
