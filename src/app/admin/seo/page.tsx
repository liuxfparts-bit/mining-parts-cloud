export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PUBLIC_PN_WHERE } from "@/lib/part-number";
import { PUBLIC_SUPPLIER_WHERE } from "@/lib/public-product";

export default async function AdminSeo() {
  const [
    brandsTotal,
    brandsPublic,
    equipmentTotal,
    equipmentPublic,
    partNumbersTotal,
    partNumbersVerified,
    partNumbersPublic,
    suppliersTotal,
    suppliersVerified,
    suppliersPublic,
  ] = await Promise.all([
    prisma.brand.count(),
    prisma.brand.count({ where: { status: "ACTIVE" } }),
    prisma.equipment.count(),
    prisma.equipment.count({ where: { status: "ACTIVE" } }),
    prisma.partNumber.count(),
    prisma.partNumber.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.partNumber.count({ where: PUBLIC_PN_WHERE }),
    prisma.supplier.count(),
    prisma.supplier.count({ where: { verifiedStatus: "VERIFIED" } }),
    prisma.supplier.count({ where: PUBLIC_SUPPLIER_WHERE }),
  ]);

  const cards = [
    ["品牌", brandsTotal, `公开 ${brandsPublic}`],
    ["设备", equipmentTotal, `公开 ${equipmentPublic}`],
    ["件号", partNumbersTotal, `VERIFIED ${partNumbersVerified} · 公开 ${partNumbersPublic}`],
    ["企业", suppliersTotal, `VERIFIED ${suppliersVerified} · 可信公开 ${suppliersPublic}`],
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-2">SEO 与公开数据概览</h1>
      <p className="text-sm text-gray-500 mb-4">总记录与真正允许进入公开页面 / sitemap 的记录分开统计。</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        {cards.map(([label, value, sub]) => (
          <div key={String(label)} className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-gray-400 mt-1">{sub}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border rounded-lg p-6 text-sm text-gray-600 space-y-1">
        <p>公开件号口径：VERIFIED + READY。</p>
        <p>可信公开企业口径：正式审核通过 + 审核轨迹完整 + 账号未禁用 + 至少一条可信公开供货产品。</p>
        <p>sitemap.xml 与公开目录使用同一 Trust Kernel 口径。</p>
      </div>
    </div>
  );
}
