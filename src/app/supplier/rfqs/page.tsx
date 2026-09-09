export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SupplierRfqs() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");

  // 公开询价大厅中未报价的
  const openRfqs = await prisma.rFQ.findMany({
    where: {
      status: "COLLECTING",
      visibility: "PUBLIC",
      quotes: { none: { supplierId: user.supplierId } },
    },
    include: { partNumber: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">询价大厅（可报价）</h1>
        <Link href="/supplier/rfqs/new" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">发布询价</Link>
      </div>
      {openRfqs.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">暂无待报价的公开询价</div>
      ) : (
        <table className="w-full bg-white border rounded-lg text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">标题</th>
              <th className="text-left p-3">件号</th>
              <th className="text-left p-3">数量</th>
              <th className="text-left p-3">采购方</th>
              <th className="text-left p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {openRfqs.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-3">{r.title}</td>
                <td className="p-3 font-mono">{r.partNumber?.number || "-"}</td>
                <td className="p-3">{r.quantity} {r.unit}</td>
                <td className="p-3">{r.contactName}</td>
                <td className="p-3">
                  <Link href={`/supplier/rfqs/${r.id}`} className="text-blue-600 hover:underline">去报价</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
