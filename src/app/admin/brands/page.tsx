export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { createBrand, deleteBrand } from "../actions";

export default async function AdminBrands() {
  const brands = await prisma.brand.findMany({
    include: { _count: { select: { equipment: true, partNumbers: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">品牌管理</h1>
      <form action={createBrand} className="bg-white rounded-lg border p-4 mb-4 flex gap-2">
        <input name="name" placeholder="品牌名（中文）" required className="border rounded px-3 py-2 text-sm" />
        <input name="nameEn" placeholder="英文名" className="border rounded px-3 py-2 text-sm" />
        <input name="country" placeholder="国家" className="border rounded px-3 py-2 text-sm" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">新增</button>
      </form>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">品牌</th>
              <th className="text-left p-3">英文名</th>
              <th className="text-left p-3">设备数</th>
              <th className="text-left p-3">件号数</th>
              <th className="text-left p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{b.id}</td>
                <td className="p-3 font-medium">{b.name}</td>
                <td className="p-3">{b.nameEn || "-"}</td>
                <td className="p-3">{b._count.equipment}</td>
                <td className="p-3">{b._count.partNumbers}</td>
                <td className="p-3">
                  <form action={async () => { "use server"; await deleteBrand(b.id); }}>
                    <button className="text-red-600 text-xs">删除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
