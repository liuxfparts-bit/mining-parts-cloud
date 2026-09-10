export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

export default async function AdminAds() {
  const [products, suppliers] = await Promise.all([
    prisma.product.count(),
    prisma.supplier.count(),
  ]);
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">广告位</h1>
      <div className="bg-white border rounded-lg p-6 text-sm text-gray-600">
        <p>当前数据库无广告表。广告功能待后续版本接入 Banner 表。</p>
        <p>现有 {products} 个产品、{suppliers} 家企业可作为推荐位来源。</p>
      </div>
    </div>
  );
}
