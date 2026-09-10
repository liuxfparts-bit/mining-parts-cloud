export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function BuyerRfqs() {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  const rfqs = user ? await prisma.rFQ.findMany({ where: { userID: user.id }, orderBy: { createdAt: "desc" } }) : [];
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">我的询价 ({rfqs.length})</h1>
        <a href="/dashboard/rfqs/new" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">发起询价</a>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr><th className="p-3 text-left">标题</th><th className="p-3 text-left">数量</th><th className="p-3 text-left">状态</th><th className="p-3 text-left">时间</th></tr></thead>
          <tbody>
            {rfqs.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-3">{r.title}</td>
                <td className="p-3">{r.quantity} {r.unit}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">{r.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
