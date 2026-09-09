export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";

export default async function AdminRfqsPage() {
  const items = await prisma.rFQ.findMany({
    include: { partNumber: true, _count: { select: { quotes: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">询价管理</h1>
        <span className="text-sm text-gray-500">共 {items.length} 条</span>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">标题</th>
              <th className="text-left p-3">件号</th>
              <th className="text-left p-3">数量</th>
              <th className="text-left p-3">类型</th>
              <th className="text-left p-3">报价数</th>
              <th className="text-left p-3">状态</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{r.id}</td>
                <td className="p-3">
                  <a href={`/rfq/${r.id}`} className="text-blue-600 hover:underline">{r.title}</a>
                </td>
                <td className="p-3 font-mono">{r.partNumber?.number || r.partNumberStr || "-"}</td>
                <td className="p-3">{r.quantity} {r.unit}</td>
                <td className="p-3">{r.purchaseType}</td>
                <td className="p-3">{r._count.quotes}</td>
                <td className="p-3"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
