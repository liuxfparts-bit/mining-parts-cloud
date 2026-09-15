import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { verifiedStatusCN } from "@/lib/verify-status";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  let stats: any[] = [];
  let recentSuppliers: any[] = [];
  let recentRfqs: any[] = [];
  let loadError = "";

  try {
    const results = await Promise.allSettled([
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
    const [brands, equipment, parts, products, suppliers, rfqs, quotes, pendingSuppliers, sList, rList, bannerCount] = results;
    recentSuppliers = sList.status === "fulfilled" ? sList.value : [];
    recentRfqs = rList.status === "fulfilled" ? rList.value : [];
    stats = [
      { label: "企业总数", value: suppliers.status === "fulfilled" ? suppliers.value : 0, href: "/admin/suppliers" },
      { label: "待审核企业", value: pendingSuppliers.status === "fulfilled" ? pendingSuppliers.value : 0, href: "/admin/verification", warn: true },
      { label: "品牌", value: brands.status === "fulfilled" ? brands.value : 0, href: "/admin/brands" },
      { label: "设备", value: equipment.status === "fulfilled" ? equipment.value : 0, href: "/admin/equipment" },
      { label: "件号", value: parts.status === "fulfilled" ? parts.value : 0, href: "/admin/part-numbers" },
      { label: "产品", value: products.status === "fulfilled" ? products.value : 0, href: "/admin/products" },
      { label: "询价单", value: rfqs.status === "fulfilled" ? rfqs.value : 0, href: "/admin/rfqs" },
      { label: "报价", value: quotes.status === "fulfilled" ? quotes.value : 0, href: "/admin/quotes" },
      { label: "广告位", value: bannerCount.status === "fulfilled" ? bannerCount.value : 0, href: "/admin/banners" },
    ];
  } catch (e: any) {
    console.error("[dashboard] ERROR", e);
    loadError = e?.message || "未知错误";
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">控制台</h1>
      {loadError && (
        <div className="p-4 mb-4 bg-red-50 text-red-700 rounded">部分统计加载失败：{loadError}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}
            className={`bg-white border rounded-lg p-5 hover:shadow-md transition-shadow ${s.warn ? "border-orange-300" : ""}`}>
            <div className={`text-2xl font-bold ${s.warn ? "text-orange-600" : "text-blue-600"}`}>{s.value ?? 0}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border">
          <div className="px-5 py-3 border-b font-medium">最近注册企业</div>
          <table className="w-full text-sm">
            <tbody>
              {recentSuppliers.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="p-3">
                    <Link href={`/admin/suppliers/${s.id}`} className="text-blue-600 hover:underline">{s.name || "-"}</Link>
                  </td>
                  <td className="p-3 text-gray-500">{s.contactName || "-"}</td>
                  <td className="p-3 text-gray-400">{s.createdAt ? new Date(s.createdAt).toLocaleDateString("zh-CN") : "-"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${s.verifiedStatus === "VERIFIED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{verifiedStatusCN(s.verifiedStatus)}</span>
                  </td>
                </tr>
              ))}
              {recentSuppliers.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted">暂无数据</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg border">
          <div className="px-5 py-3 border-b font-medium">最近询价</div>
          <table className="w-full text-sm">
            <tbody>
              {recentRfqs.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-3">
                    <Link href={`/admin/rfqs/${r.id}`} className="text-blue-600 hover:underline">{r.title || "-"}</Link>
                  </td>
                  <td className="p-3 font-mono text-xs">{r.partNumber?.number || r.partNumberStr || "-"}</td>
                  <td className="p-3">{r.quantity ?? "-"} {r.unit || ""}</td>
                  <td className="p-3 text-gray-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("zh-CN") : "-"}</td>
                </tr>
              ))}
              {recentRfqs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted">暂无数据</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
