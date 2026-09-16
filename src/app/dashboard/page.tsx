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

  const rfqCount = user ? await prisma.rFQ.count({ where: { userID: user.id } }) : 0;
  const quoteCount = user
    ? await prisma.quote.count({ where: { rfq: { userID: user.id } } })
    : 0;

  const stats = [
    { label: "我的询价", value: rfqCount, href: "/dashboard/rfqs" },
    { label: "收到报价", value: quoteCount, href: "/dashboard/quotes" },
    { label: "企业状态", value: supplier?.verifiedStatus || "未关联", href: "/dashboard/company" },
    { label: "会员等级", value: supplier?.memberLevel || "-", href: "/dashboard/company" },
  ];

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <h1 className="text-xl font-bold">控制台</h1>
        <form action={async () => {
          "use server";
          const { signOut } = await import("@/lib/auth");
          await signOut({ redirectTo: "/login" });
        }}>
          <button className="text-sm border px-3 py-1 rounded">退出登录</button>
        </form>
      </div>
      <div className="flex flex-col lg:flex-row lg:gap-6">
        <aside className="lg:w-48 shrink-0 mb-4 lg:mb-0">
          <h3 className="font-bold mb-4">控制台</h3>
          <nav className="flex lg:flex-col gap-3 lg:gap-2 text-sm overflow-x-auto pb-2 lg:pb-0">
            <Link href="/dashboard" className="block text-blue-600 font-medium whitespace-nowrap">概览</Link>
            <Link href="/dashboard/company" className="block text-gray-600 hover:text-blue-600 whitespace-nowrap">我的资料</Link>
            <Link href="/dashboard/rfqs" className="block text-gray-600 hover:text-blue-600 whitespace-nowrap">我的询价</Link>
            <Link href="/dashboard/quotes" className="block text-gray-600 hover:text-blue-600 whitespace-nowrap">报价管理</Link>
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold mb-2">欢迎，{user?.name}</h1>
          <p className="text-gray-500 mb-6">{supplier?.name || "完善企业资料"}</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
