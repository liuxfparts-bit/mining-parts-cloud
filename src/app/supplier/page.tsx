export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function SupplierHome() {
  const session = await auth();
  const email = (session?.user as any)?.email;
  const user = await prisma.user.findUnique({ where: { email } });
  const supplier = user?.supplierId
    ? await prisma.supplier.findUnique({
        where: { id: user.supplierId },
        include: { _count: { select: { products: true, quotes: true } } },
      })
    : null;

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-4">供应商工作台</h1>

      {supplier ? (
        <>
          <div className="bg-white rounded-lg border p-6 mb-4">
            <h2 className="font-bold text-lg">{supplier.name}</h2>
            <p className="text-gray-500 text-sm mt-1">{supplier.contactName} · {supplier.mobile || supplier.email}</p>
            <div className="mt-3 flex gap-2">
              <span className={`px-3 py-1 rounded text-sm ${
                supplier.verifiedStatus === "VERIFIED" ? "bg-green-100 text-green-700" :
                supplier.verifiedStatus === "REJECTED" ? "bg-red-100 text-red-700" :
                "bg-yellow-100 text-yellow-700"
              }`}>
                {supplier.verifiedStatus === "VERIFIED" ? "已认证" :
                 supplier.verifiedStatus === "REJECTED" ? "已驳回" : "待审核"}
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">{supplier.memberLevel}</span>
            </div>
            {supplier.verifiedStatus === "REJECTED" && supplier.rejectionReason && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
                驳回原因：{supplier.rejectionReason}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <Link href="/supplier/products" className="bg-white border rounded-lg p-4 hover:shadow">
              <div className="text-sm text-gray-500">我的产品</div>
              <div className="text-2xl font-bold mt-1">{supplier._count.products}</div>
            </Link>
            <Link href="/supplier/quotes" className="bg-white border rounded-lg p-4 hover:shadow">
              <div className="text-sm text-gray-500">收到报价/报价数</div>
              <div className="text-2xl font-bold mt-1">{supplier._count.quotes}</div>
            </Link>
            <Link href="/supplier/profile" className="bg-white border rounded-lg p-4 hover:shadow">
              <div className="text-sm text-gray-500">企业资料</div>
              <div className="text-sm mt-1 text-blue-600">编辑 →</div>
            </Link>
          </div>
        </>
      ) : (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          您还没有企业资料，请先完善。
        </div>
      )}
    </div>
  );
}
