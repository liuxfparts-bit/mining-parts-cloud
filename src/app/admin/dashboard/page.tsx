export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";

export default async function AdminDashboard() {
  const [brands, equipment, parts, products, suppliers, rfqs, quotes] = await Promise.all([
    prisma.brand.count(),
    prisma.equipment.count(),
    prisma.partNumber.count(),
    prisma.product.count(),
    prisma.supplier.count(),
    prisma.rFQ.count(),
    prisma.quote.count(),
  ]);

  const stats = [
    { label: "品牌", value: brands },
    { label: "设备", value: equipment },
    { label: "件号", value: parts },
    { label: "产品", value: products },
    { label: "供应商", value: suppliers },
    { label: "询价单", value: rfqs },
    { label: "报价", value: quotes },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">控制台</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border rounded-lg p-5">
            <div className="text-2xl font-bold text-blue-600">{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
