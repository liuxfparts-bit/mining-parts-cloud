import { prisma } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminQuotes() {
  const quotes = await prisma.quote.findMany({
    include: { supplier: true, rfq: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">报价记录</h1>
      <div className="bg-white border border-line rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f8f9] border-b border-line">
            <tr>
              <th className="text-left p-3 font-bold">询价单</th>
              <th className="text-left p-3 font-bold">供应商</th>
              <th className="text-right p-3 font-bold">单价</th>
              <th className="text-left p-3 font-bold">交期</th>
              <th className="text-left p-3 font-bold">质保</th>
              <th className="text-left p-3 font-bold">状态</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} className="border-b border-line last:border-0">
                <td className="p-3">
                  <Link href={`/rfq/${q.rfqId}`} className="text-accent hover:underline">
                    {q.rfq.title}
                  </Link>
                </td>
                <td className="p-3">{q.supplier.shortName || q.supplier.name}</td>
                <td className="p-3 text-right font-bold text-green">
                  {q.currency} {q.unitPrice?.toLocaleString()}
                </td>
                <td className="p-3 text-muted">{q.leadTime || "-"}</td>
                <td className="p-3 text-muted">{q.warranty || "-"}</td>
                <td className="p-3"><span className="text-xs px-2 py-1 bg-gray-100 rounded">{q.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
