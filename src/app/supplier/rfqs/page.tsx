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

  const openRfqs = await prisma.rFQ.findMany({
    where: { status: "COLLECTING", visibility: "PUBLIC", quotes: { none: { supplierId: user.supplierId } } },
    include: { partNumber: { include: { brand: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">询价大厅（可报价）</h1>
        <Link href="/supplier/profile" className="border px-4 py-2 rounded text-sm">订阅配件通知 / 设置接单偏好</Link>
      </div>
      {openRfqs.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">暂无待报价的公开询价</div>
      ) : (
        <div className="grid gap-3">
          {openRfqs.map((r) => (
            <div key={r.id} className="bg-white border rounded-lg p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium">{r.title}</div>
                <div className="flex gap-2 mt-2 text-xs text-gray-500 flex-wrap">
                  <span className="font-mono border rounded px-1.5 py-0.5">{r.partNumber?.number || "-"}</span>
                  {r.partNumber?.brand && <span className="bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{r.partNumber.brand.name}</span>}
                  <span>数量：{r.quantity} {r.unit}</span>
                  {r.expiresAt && <span className="text-orange-600">截止：{r.expiresAt.toLocaleDateString()}</span>}
                </div>
                <div className="text-xs text-gray-400 mt-1">采购方：{r.contactName}</div>
              </div>
              <Link href={`/supplier/rfqs/${r.id}`} className="ml-4 bg-blue-600 text-white px-4 py-2 rounded text-sm whitespace-nowrap">去报价</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
