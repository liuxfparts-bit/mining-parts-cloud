export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const MEMBER_CN: Record<string, string> = { FREE: "免费会员", BRONZE: "铜牌会员", SILVER: "银牌会员", GOLD: "金牌会员" };

export default async function SupplierHome() {
  const session = await auth();
  const email = (session?.user as any)?.email;
  const user = await prisma.user.findUnique({ where: { email } });
  const supplier = user?.supplierId
    ? await prisma.supplier.findUnique({
        where: { id: user.supplierId },
        include: {
          _count: { select: { products: true, quotes: true } },
        },
      })
    : null;

  // KPIs
  const onlineProducts = supplier ? await prisma.product.count({ where: { supplierId: supplier.id, status: "PUBLISHED" } }) : 0;
  const pendingQuotes = supplier ? await prisma.quote.count({ where: { supplierId: supplier.id, status: "PENDING" } }) : 0;
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const quotedThisMonth = supplier ? await prisma.quote.count({ where: { supplierId: supplier.id, createdAt: { gte: startOfMonth } } }) : 0;

  let profileComplete = 0;
  if (supplier) {
    const fields = [supplier.name, supplier.contactName, supplier.mobile, supplier.email, supplier.mainBusiness, supplier.mainBrands, supplier.mainEquipment, supplier.description];
    profileComplete = Math.round(fields.filter(Boolean).length / fields.length * 100);
  }

  const recentRfqs = await prisma.rFQ.findMany({
    where: { status: "COLLECTING" },
    include: { partNumber: { include: { brand: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">供应商工作台</h1>
          {supplier && (
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span>{supplier.name}</span>
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">{MEMBER_CN[supplier.memberLevel] || supplier.memberLevel}</span>
              {supplier.verifiedStatus === "VERIFIED" && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">已认证</span>}
              <span className="text-gray-400">|</span>
              <span>{supplier.contactName}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/supplier/products/new" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">+ 发布新产品</Link>
          <Link href="/supplier/profile" className="border px-4 py-2 rounded text-sm">设置接单偏好</Link>
          <form action={async () => { "use server"; const { signOut } = await import("@/lib/auth"); await signOut({ redirectTo: "/login" }); }}>
            <button className="border px-4 py-2 rounded text-sm text-gray-600">退出</button>
          </form>
        </div>
      </div>

      {supplier ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white border rounded-lg p-4">
              <div className="text-sm text-gray-500">在线产品</div>
              <div className="text-2xl font-bold mt-1">{onlineProducts}</div>
              <Link href="/supplier/products" className="text-xs text-blue-600 mt-1 inline-block">管理 →</Link>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <div className="text-sm text-gray-500">待处理询价</div>
              <div className="text-2xl font-bold mt-1">{pendingQuotes}</div>
              <Link href="/supplier/rfqs" className="text-xs text-blue-600 mt-1 inline-block">去报价 →</Link>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <div className="text-sm text-gray-500">本月已报价</div>
              <div className="text-2xl font-bold mt-1">{quotedThisMonth}</div>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <div className="text-sm text-gray-500">资料完整度</div>
              <div className="text-2xl font-bold mt-1">{profileComplete}%</div>
              <Link href="/supplier/profile" className="text-xs text-blue-600 mt-1 inline-block">完善 →</Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Left: shortcuts */}
            <div className="bg-white border rounded-lg p-4">
              <h2 className="font-bold mb-3">高频功能</h2>
              <div className="space-y-2">
                <Link href="/supplier/products" className="block border rounded p-3 hover:bg-gray-50">
                  <div className="font-medium text-sm">产品管理</div>
                  <div className="text-xs text-gray-500 mt-0.5">共 {supplier._count.products} 个产品</div>
                </Link>
                <Link href="/supplier/rfqs" className="block border rounded p-3 hover:bg-gray-50">
                  <div className="font-medium text-sm">询价大厅</div>
                  <div className="text-xs text-gray-500 mt-0.5">查看采购需求并报价</div>
                </Link>
                <Link href="/supplier/part-number-requests" className="block border rounded p-3 hover:bg-gray-50">
                  <div className="font-medium text-sm">件号申请</div>
                  <div className="text-xs text-gray-500 mt-0.5">申请新件号</div>
                </Link>
                <Link href="/supplier/profile" className="block border rounded p-3 hover:bg-gray-50">
                  <div className="font-medium text-sm">企业资料</div>
                  <div className="text-xs text-gray-500 mt-0.5">编辑公司信息</div>
                </Link>
              </div>
            </div>

            {/* Right: matching RFQs */}
            <div className="col-span-2 bg-white border rounded-lg p-4">
              <h2 className="font-bold mb-3">最新询价</h2>
              {recentRfqs.length === 0 ? (
                <p className="text-sm text-gray-500">暂无可报价询价</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr><th className="text-left p-2">询价标题</th><th className="text-left p-2">件号</th><th className="text-left p-2">数量</th><th className="text-left p-2">截止</th><th></th></tr>
                  </thead>
                  <tbody>
                    {recentRfqs.map((r) => (
                      <tr key={r.id} className="border-b">
                        <td className="p-2">{r.title}</td>
                        <td className="p-2 font-mono">{r.partNumber?.number || r.partNumberStr}</td>
                        <td className="p-2">{r.quantity} {r.unit}</td>
                        <td className="p-2 text-gray-500">{r.expiresAt?.toLocaleDateString() || "-"}</td>
                        <td className="p-2"><Link href={`/supplier/rfqs`} className="text-blue-600 text-xs">报价 →</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">您还没有企业资料，请先完善。</div>
      )}
    </div>
  );
}
