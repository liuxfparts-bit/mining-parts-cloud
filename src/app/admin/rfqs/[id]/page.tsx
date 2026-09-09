export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updateRfqStatus } from "../../actions";

export default async function RfqDetail({ params }: { params: { id: string } }) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: parseInt(params.id) },
    include: { partNumber: true, brand: true, equipment: true, quotes: { include: { supplier: true } } },
  });
  if (!rfq) notFound();

  return (
    <div className="p-6">
      <a href="/admin/rfqs" className="text-sm text-blue-600 hover:underline">← 返回询价列表</a>

      <div className="bg-white rounded-lg border p-6 mt-4">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-xl font-bold">{rfq.title}</h1>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">{rfq.status}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-gray-500">件号：</span>{rfq.partNumber?.number || rfq.partNumberStr || "-"}</div>
          <div><span className="text-gray-500">数量：</span>{rfq.quantity} {rfq.unit}</div>
          <div><span className="text-gray-500">类型：</span>{rfq.purchaseType}</div>
          <div><span className="text-gray-500">联系人：</span>{rfq.contactName}</div>
          <div><span className="text-gray-500">电话：</span>{rfq.contactPhone}</div>
          <div><span className="text-gray-500">发布：</span>{rfq.createdAt.toLocaleString("zh-CN")}</div>
        </div>
        <p className="mt-4 text-sm text-gray-700">{rfq.description}</p>
      </div>

      {/* 状态操作 */}
      <div className="bg-white rounded-lg border p-6 mt-4">
        <h2 className="font-bold mb-3">修改状态</h2>
        <div className="flex gap-2 flex-wrap">
          {["COLLECTING", "QUOTED", "SELECTED", "CLOSED", "EXPIRED"].map((st) => (
            <form key={st} action={async () => { "use server"; await updateRfqStatus(rfq.id, st); }}>
              <button className={`px-3 py-1 rounded text-sm ${rfq.status === st ? "bg-blue-600 text-white" : "bg-gray-100"}`}>{st}</button>
            </form>
          ))}
        </div>
      </div>

      {/* 报价列表 */}
      <div className="bg-white rounded-lg border p-6 mt-4">
        <h2 className="font-bold mb-3">报价 ({rfq.quotes.length})</h2>
        {rfq.quotes.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无报价</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">供应商</th>
                <th className="text-left p-2">单价</th>
                <th className="text-left p-2">交期</th>
                <th className="text-left p-2">质保</th>
              </tr>
            </thead>
            <tbody>
              {rfq.quotes.map((q) => (
                <tr key={q.id} className="border-b">
                  <td className="p-2">{q.supplier.name}</td>
                  <td className="p-2">{q.unitPrice} {q.currency}</td>
                  <td className="p-2">{q.leadTime || "-"}</td>
                  <td className="p-2">{q.warranty || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
