export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function SupplierQuotes() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");
  const quotes = await prisma.quote.findMany({
    where: { supplierId: user.supplierId },
    include: { rfq: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">我的报价</h1>
      {quotes.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">暂无报价记录</div>
      ) : (
        <table className="w-full bg-white border rounded-lg text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">RFQ</th>
              <th className="text-left p-3">单价</th>
              <th className="text-left p-3">交期</th>
              <th className="text-left p-3">时间</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} className="border-b">
                <td className="p-3">{q.rfq.title}</td>
                <td className="p-3">{q.unitPrice} {q.currency}</td>
                <td className="p-3">{q.leadTime || "-"}</td>
                <td className="p-3">{q.createdAt.toLocaleDateString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
