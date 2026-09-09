export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  const email = (session?.user as any)?.email;
  const user = await prisma.user.findUnique({ where: { email } });

  const supplier = user?.supplierId
    ? await prisma.supplier.findUnique({
        where: { id: user.supplierId },
        include: { _count: { select: { products: true, quotes: true } } },
      })
    : null;

  const stats = [
    { label: "我的产品", value: supplier?._count.products ?? 0, href: "/dashboard/products" },
    { label: "我的报价", value: supplier?._count.quotes ?? 0, href: "/dashboard/quotes" },
    { label: "企业状态", value: supplier?.verifiedStatus || "未关联", href: "/dashboard/company" },
    { label: "会员等级", value: supplier?.memberLevel || "-", href: "/dashboard/company" },
  ];

  return (
    <div className="p-8">
      <div className="flex gap-6">
        <aside className="w-48 shrink-0">
          <h3 className="font-bold mb-4">控制台</h3>
          <nav className="space-y-2 text-sm">
            <Link href="/dashboard" className="block text-blue-600 font-medium">概览</Link>
            <Link href="/dashboard/company" className="block text-gray-600 hover:text-blue-600">企业资料</Link>
            <Link href="/dashboard/products" className="block text-gray-600 hover:text-blue-600">我的产品</Link>
            <Link href="/dashboard/rfqs" className="block text-gray-600 hover:text-blue-600">我的询价</Link>
            <Link href="/dashboard/quotes" className="block text-gray-600 hover:text-blue-600">报价管理</Link>
          </nav>
        </aside>
        <main className="flex-1">
          <h1 className="text-2xl font-bold mb-2">欢迎，{user?.name}</h1>
          <p className="text-gray-500 mb-6">{supplier?.name || "完善企业资料"}</p>

          <div className="grid grid-cols-4 gap-4 mb-6">
            {stats.map((s) => (
              <a key={s.label} href={s.href} className="bg-white border rounded-lg p-4 hover:shadow">
                <div className="text-sm text-gray-500">{s.label}</div>
                <div className="text-2xl font-bold mt-1">{s.value}</div>
              </a>
            ))}
          </div>

          {supplier?.verifiedStatus === "PENDING" && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
              您的企业资料正在审核中，审核通过后即可上传产品。
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
