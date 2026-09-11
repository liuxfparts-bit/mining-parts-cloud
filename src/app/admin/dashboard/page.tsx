import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  let stats: any[] = [];
  let recentSuppliers: any[] = [];
  let recentRfqs: any[] = [];
  try {
    const [brands, equipment, parts, products, suppliers, rfqs, quotes, pendingSuppliers, sList, rList, bannerCount] = await Promise.all([
      prisma.brand.count(),
      prisma.equipment.count(),
      prisma.partNumber.count(),
      prisma.product.count(),
      prisma.supplier.count(),
      prisma.rFQ.count(),
      prisma.quote.count(),
      prisma.supplier.count({ where: { verifiedStatus: "PENDING" } }),
      prisma.supplier.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.rFQ.findMany({ include: { partNumber: true }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.banner.count().catch(() => 0),
    ]);
    recentSuppliers = sList;
    recentRfqs = rList;
    stats = [
      { label: "企业总数", value: suppliers, href: "/admin/suppliers" },
      { label: "待审核企业", value: pendingSuppliers, href: "/admin/verification", warn: true },
      { label: "品牌", value: brands, href: "/admin/brands" },
      { label: "设备", value: equipment, href: "/admin/equipment" },
      { label: "件号", value: parts, href: "/admin/part-numbers" },
      { label: "产品", value: products, href: "/admin/products" },
      { label: "询价单", value: rfqs, href: "/admin/rfqs" },
      { label: "报价", value: quotes, href: "/admin/quotes" },
      { label: "广告位", value: bannerCount, href: "/admin/banners" },
    ];
  } catch (e: any) {
    return <div className="p-6 text-red-600">控制台加载失败：{e?.message || "未知错误"}。请确认数据库已迁移。</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">控制台</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}
            className={`bg-white border rounded-lg p-5 hover:shadow-md transition-shadow ${s.warn ? "border-orange-300" : ""}`}>
            <div className={`text-2xl font-bold ${s.warn ? "text-orange-600" : "text-blue-600"}`}>{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近企业 */}
        <div className="bg-white rounded-lg border">
          <div className="px-5 py-3 border-b font-medium">最近注册企业</div>
          <table className="w-full text-sm">
            <tbody>
              {recentSuppliers.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="p-3">
                    <Link href={`/admin/suppliers/${s.id}`} className="text-blue-600 hover:underline">{s.name}</Link>
                  </td>
                  <td className="p-3 text-gray-500">{s.contactName || "-"}</td>
                  <td className="p-3 text-gray-400">{s.createdAt.toLocaleDateString("zh-CN")}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${s.verifiedStatus === "VERIFIED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{s.verifiedStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 最近询价 */}
        <div className="bg-white rounded-lg border">
          <div className="px-5 py-3 border-b font-medium">最近询价</div>
          <table className="w-full text-sm">
            <tbody>
              {recentRfqs.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-3">
                    <Link href={`/admin/rfqs/${r.id}`} className="text-blue-600 hover:underline">{r.title}</Link>
                  </td>
                  <td className="p-3 font-mono text-xs">{r.partNumber?.number || r.partNumberStr || "-"}</td>
                  <td className="p-3">{r.quantity} {r.unit}</td>
                  <td className="p-3 text-gray-400">{r.createdAt.toLocaleDateString("zh-CN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
