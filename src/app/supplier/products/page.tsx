export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SupplierProducts() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");
  const products = await prisma.product.findMany({
    where: { supplierId: user.supplierId },
    include: { partNumber: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">我的产品</h1>
        <Link href="/supplier/products/new" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">新增产品</Link>
      </div>
      {products.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">
          暂无产品，联系管理员上架产品
        </div>
      ) : (
        <table className="w-full bg-white border rounded-lg text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">图片</th>
              <th className="text-left p-3">产品</th>
              <th className="text-left p-3">件号</th>
              <th className="text-left p-3">状态</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-3">
                  {p.images ? (
                    <img src={p.images.split(",")[0]} className="h-12 rounded border" />
                  ) : <span className="text-gray-400">-</span>}
                </td>
                <td className="p-3">{p.name}</td>
                <td className="p-3 font-mono">{p.partNumber?.number || "-"}</td>
                <td className="p-3">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
