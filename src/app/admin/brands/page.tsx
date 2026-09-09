export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { createBrand, deleteBrand } from "../actions";

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

      {/* 新增品牌表单 */}
      <form action={createBrand} className="bg-white rounded-lg border p-4 mb-4 flex gap-3 items-end">
        <input name="name" placeholder="品牌名 (如: Sandvik)" required className="border rounded px-3 py-2 text-sm w-48" />
        <input name="nameEn" placeholder="英文名" className="border rounded px-3 py-2 text-sm w-40" />
        <input name="country" placeholder="国家" className="border rounded px-3 py-2 text-sm w-32" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">新增品牌</button>
      </form>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">品牌名</th>
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
                <td className="p-3 text-gray-600">{b.nameEn || "-"}</td>
                <td className="p-3">{b._count.equipment}</td>
                <td className="p-3">{b._count.partNumbers}</td>
                <td className="p-3">
                  <form action={async () => { "use server"; await deleteBrand(b.id); }}>
                    <button className="text-red-600 text-sm hover:underline">删除</button>
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
