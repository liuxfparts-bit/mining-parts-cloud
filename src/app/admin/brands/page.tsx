export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { createBrand, deleteBrand } from "../actions";
import Pagination from "@/components/Pagination";

export default async function AdminBrands({ searchParams }: { searchParams: { q?: string; page?: string; pageSize?: string } }) {
  const q = (searchParams.q || "").trim();
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [20, 50, 100].includes(parseInt(searchParams.pageSize || "20")) ? parseInt(searchParams.pageSize || "20") : 20;
  const where = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { nameEn: { contains: q, mode: "insensitive" as const } }] } : {};
  const [brands, total] = await Promise.all([
    prisma.brand.findMany({ where, include: { _count: { select: { equipment: true, partNumbers: true } } }, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.brand.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">品牌管理</h1>
      <form method="GET" className="bg-white rounded-lg border p-3 mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="品牌名 / 英文名" className="border rounded px-3 py-2 text-sm flex-1" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">搜索</button>
        <a href="/admin/brands" className="border px-4 py-2 rounded text-sm">重置</a>
      </form>
      <form action={createBrand} className="bg-white rounded-lg border p-3 mb-4 flex gap-2">
        <input name="name" placeholder="品牌名（中文）" required className="border rounded px-3 py-2 text-sm" />
        <input name="nameEn" placeholder="英文名" className="border rounded px-3 py-2 text-sm" />
        <input name="country" placeholder="国家" className="border rounded px-3 py-2 text-sm" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">新增</button>
      </form>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr><th className="text-left p-3">ID</th><th className="text-left p-3">品牌</th><th className="text-left p-3">英文名</th><th className="text-left p-3">设备数</th><th className="text-left p-3">件号数</th><th className="text-left p-3">操作</th></tr>
          </thead>
          <tbody>
            {brands.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-gray-500">暂无数据</td></tr> :
              brands.map((b) => (
                <tr key={b.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{b.id}</td>
                  <td className="p-3 font-medium">{b.name}</td>
                  <td className="p-3">{b.nameEn || "-"}</td>
                  <td className="p-3">{b._count.equipment}</td>
                  <td className="p-3">{b._count.partNumbers}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <a href={`/admin/brands/${b.id}`} className="text-blue-600 text-xs">编辑</a>
                      <form action={async () => { "use server"; await deleteBrand(b.id); }}>
                        <button className="text-red-600 text-xs">删除</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} baseQuery={new URLSearchParams(searchParams as any)} />
    </div>
  );
}
