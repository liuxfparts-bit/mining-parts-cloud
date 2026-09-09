import { prisma } from "@/lib/db";
import { Building2, Tags, Wrench, Package, Hash, FileText, MessageSquare, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [
    brandCount, equipmentCount, partNumberCount, productCount,
    supplierCount, pendingSuppliers, rfqCount, quoteCount, userCount,
  ] = await Promise.all([
    prisma.brand.count(),
    prisma.equipment.count(),
    prisma.partNumber.count(),
    prisma.product.count(),
    prisma.supplier.count(),
    prisma.supplier.count({ where: { verifiedStatus: "PENDING" } }),
    prisma.rFQ.count(),
    prisma.quote.count(),
    prisma.user.count(),
  ]);

  const stats = [
    { label: "品牌", value: brandCount, icon: Tags, color: "text-blue-600" },
    { label: "设备", value: equipmentCount, icon: Wrench, color: "text-green-600" },
    { label: "件号", value: partNumberCount, icon: Hash, color: "text-accent" },
    { label: "产品", value: productCount, icon: Package, color: "text-purple-600" },
    { label: "供应商", value: supplierCount, icon: Building2, color: "text-orange-600" },
    { label: "待审核企业", value: pendingSuppliers, icon: Building2, color: "text-red-500" },
    { label: "询价单", value: rfqCount, icon: FileText, color: "text-blue-600" },
    { label: "报价", value: quoteCount, icon: MessageSquare, color: "text-green-600" },
    { label: "用户", value: userCount, icon: Users, color: "text-gray-600" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-lg p-5 border border-line">
            <s.icon className={`h-6 w-6 ${s.color} mb-2`} />
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 快捷入口 */}
      <h2 className="text-lg font-bold mt-8 mb-4">快捷操作</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <a href="/admin/suppliers" className="bg-white border border-line rounded-lg p-4 text-sm hover:shadow-md">
          企业列表 →
        </a>
        <a href="/admin/brands" className="bg-white border border-line rounded-lg p-4 text-sm hover:shadow-md">
          品牌管理 →
        </a>
        <a href="/admin/rfqs" className="bg-white border border-line rounded-lg p-4 text-sm hover:shadow-md">
          询价管理 →
        </a>
        <a href="/admin/quotes" className="bg-white border border-line rounded-lg p-4 text-sm hover:shadow-md">
          报价记录 →
        </a>
      </div>
    </div>
  );
}
