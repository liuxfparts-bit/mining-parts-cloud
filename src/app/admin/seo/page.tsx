export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

export default async function AdminSeo() {
  const [brands, equipments, partNumbers, suppliers] = await Promise.all([
    prisma.brand.count(),
    prisma.equipment.count(),
    prisma.partNumber.count(),
    prisma.supplier.count(),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">SEO 概览</h1>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white border rounded-lg p-4"><div className="text-sm text-gray-500">品牌页</div><div className="text-2xl font-bold">{brands}</div></div>
        <div className="bg-white border rounded-lg p-4"><div className="text-sm text-gray-500">设备页</div><div className="text-2xl font-bold">{equipments}</div></div>
        <div className="bg-white border rounded-lg p-4"><div className="text-sm text-gray-500">件号页</div><div className="text-2xl font-bold">{partNumbers}</div></div>
        <div className="bg-white border rounded-lg p-4"><div className="text-sm text-gray-500">企业页</div><div className="text-2xl font-bold">{suppliers}</div></div>
      </div>
      <div className="bg-white border rounded-lg p-6 text-sm text-gray-600">
        <p>robots.txt、sitemap.xml 已由 Next.js 自动生成。</p>
        <p>各页面 Meta Title / Description 从数据库 seoTitle / seoDescription 字段自动读取。</p>
      </div>
    </div>
  );
}
