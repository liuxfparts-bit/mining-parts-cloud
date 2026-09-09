export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";

export default async function AdminQuotesPage() {
  const items = await prisma.quote.findMany({
    include: { supplier: true, rfq: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">报价记录</h1>
        <span className="text-sm text-gray-500">共 {items.length} 条</span>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">RFQ</th>
              <th className="text-left p-3">供应商</th>
              <th className="text-left p-3">单价</th>
              <th className="text-left p-3">交期</th>
              <th className="text-left p-3">状态</th>
            </tr>
          </thead>
          <tbody>
            {items.map((q) => (
              <tr key={q.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{q.id}</td>
                <td className="p-3"><a href={`/rfq/${q.rfqId}`} className="text-blue-600">#{q.rfqId}</a></td>
                <td className="p-3">{q.supplier.name}</td>
                <td className="p-3">{q.unitPrice ? `${q.currency} ${q.unitPrice}` : "-"}</td>
                <td className="p-3">{q.leadTime || "-"}</td>
                <td className="p-3">{q.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
