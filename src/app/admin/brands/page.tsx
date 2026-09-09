import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminBrandsPage() {
  const brands = await prisma.brand.findMany({
    include: { _count: { select: { equipment: true, partNumbers: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">品牌管理</h1>
        <span className="text-sm text-gray-500">共 {brands.length} 个品牌</span>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">ID</th>
              <th className="text-left p-3 font-medium">品牌名</th>
              <th className="text-left p-3 font-medium">英文名</th>
              <th className="text-left p-3 font-medium">国家</th>
              <th className="text-left p-3 font-medium">设备数</th>
              <th className="text-left p-3 font-medium">件号数</th>
              <th className="text-left p-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{b.id}</td>
                <td className="p-3 font-medium">
                  <Link href={`/brands/${b.slug}`} className="text-blue-600 hover:underline">{b.name}</Link>
                </td>
                <td className="p-3 text-gray-600">{b.nameEn || "-"}</td>
                <td className="p-3">{b.country || "-"}</td>
                <td className="p-3">{b._count.equipment}</td>
                <td className="p-3">{b._count.partNumbers}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{b.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
