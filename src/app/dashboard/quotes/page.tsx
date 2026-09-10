export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function BuyerQuotes() {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  const rfqs = user ? await prisma.rFQ.findMany({ where: { userID: user.id }, select: { id: true } }) : [];
  const rfqIds = rfqs.map((r) => r.id);
  const quotes = await prisma.quote.findMany({
    where: { rfqId: { in: rfqIds } },
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">收到的报价 ({quotes.length})</h1>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr><th className="p-3 text-left">供应商</th><th className="p-3 text-left">单价</th><th className="p-3 text-left">币种</th><th className="p-3 text-left">交期</th><th className="p-3 text-left">时间</th></tr></thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} className="border-b">
                <td className="p-3">{q.supplier?.name}</td>
                <td className="p-3">{q.unitPrice}</td>
                <td className="p-3">{q.currency}</td>
                <td className="p-3">{q.leadTime || "-"}</td>
                <td className="p-3">{q.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
