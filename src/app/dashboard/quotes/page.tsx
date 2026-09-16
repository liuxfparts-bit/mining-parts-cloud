export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCompanyUserIds } from "@/lib/buyer-company";

export default async function BuyerQuotes() {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: (s.user as any).email },
    select: { id: true, buyerCompanyId: true },
  });
  if (!user) redirect("/login");
  // 企业共享：本人 + 同企业主/子账号发布的 RFQ 收到的报价
  const companyUserIds = await getCompanyUserIds(user.id);
  const rfqs = await prisma.rFQ.findMany({
    where: { OR: [{ userID: { in: companyUserIds } }, { companyID: user.buyerCompanyId ?? -1 }] },
    select: { id: true },
  });
  const rfqIds = rfqs.map((r) => r.id);
  const quotes = await prisma.quote.findMany({
    where: { rfqId: { in: rfqIds } },
    include: { supplier: true, rfq: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">收到的报价 ({quotes.length})</h1>
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3 text-left">询价</th>
              <th className="p-3 text-left">供应商</th>
              <th className="p-3 text-left">单价</th>
              <th className="p-3 text-left">币种</th>
              <th className="p-3 text-left">交期</th>
              <th className="p-3 text-left">质保</th>
              <th className="p-3 text-left">备注</th>
              <th className="p-3 text-left">时间</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} className="border-b">
                <td className="p-3">{q.rfq?.title}</td>
                <td className="p-3">{q.supplier?.name}</td>
                <td className="p-3">{q.unitPrice}</td>
                <td className="p-3">{q.currency}</td>
                <td className="p-3">{q.leadTime || "-"}</td>
                <td className="p-3">{q.warranty || "-"}</td>
                <td className="p-3 max-w-xs truncate">{q.remarks || "-"}</td>
                <td className="p-3">{q.createdAt.toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
