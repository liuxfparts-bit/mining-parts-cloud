export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { createEquipment, deleteEquipment, toggleEquipmentStatus } from "../actions";
import ConfirmButton from "./ConfirmButton";
import Pagination from "@/components/Pagination";

export default async function AdminEquipmentPage({ searchParams }: { searchParams: { q?: string; page?: string; pageSize?: string; brandId?: string } }) {
  const q = (searchParams.q || "").trim();
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [20, 50, 100].includes(parseInt(searchParams.pageSize || "20")) ? parseInt(searchParams.pageSize || "20") : 20;
  const brandId = searchParams.brandId ? parseInt(searchParams.brandId) : null;
  const where: any = {};
  if (q) where.OR = [{ model: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { nameEn: { contains: q, mode: "insensitive" } }, { brand: { name: { contains: q, mode: "insensitive" } } }];
  if (brandId) where.brandId = brandId;
  const [items, total, brands] = await Promise.all([
    prisma.equipment.findMany({ where, include: { brand: true, _count: { select: { partNumbers: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.equipment.count({ where }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">设备管理</h1>
      <form method="GET" className="bg-white rounded-lg border p-3 mb-4 flex gap-2 flex-wrap">
        <input name="q" defaultValue={q} placeholder="型号 / 名称 / 品牌" className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]" />
        <select name="brandId" className="border rounded px-3 py-2 text-sm">
          <option value="">全部品牌</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">搜索</button>
        <a href="/admin/equipment" className="border px-4 py-2 rounded text-sm">重置</a>
      </form>
      <form action={createEquipment} className="bg-white rounded-lg border p-3 mb-4 flex gap-2 items-end flex-wrap">
        <select name="brandId" required className="border rounded px-3 py-2 text-sm">
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input name="model" placeholder="型号 (如 MB670-1)" required className="border rounded px-3 py-2 text-sm" />
        <input name="name" placeholder="设备名" required className="border rounded px-3 py-2 text-sm" />
        <input name="equipmentType" placeholder="类型" required className="border rounded px-3 py-2 text-sm" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">新增设备</button>
      </form>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr><th className="text-left p-3">缩略图</th><th className="text-left p-3">品牌</th><th className="text-left p-3">型号</th><th className="text-left p-3">名称</th><th className="text-left p-3">类型</th><th className="text-left p-3">件号数</th><th className="text-left p-3">操作</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-gray-500">暂无数据</td></tr> :
              items.map((e) => (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{e.imageUrl ? <img src={e.imageUrl} className="h-10 w-16 object-cover rounded" /> : <span className="text-xs text-gray-400">暂无图片</span>}</td>
                  <td className="p-3">{e.brand.name}</td>
                  <td className="p-3 font-medium">{e.model}</td>
                  <td className="p-3">{e.name}</td>
                  <td className="p-3">{e.equipmentType}</td>
                  <td className="p-3">{e._count.partNumbers}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <a href={`/admin/equipment/${e.id}/edit`} className="text-xs text-blue-600">编辑</a>
                      <form action={async () => { "use server"; await toggleEquipmentStatus(e.id); }}>
                        <button className="text-xs text-gray-600">{e.status === "ACTIVE" ? "下架" : "启用"}</button>
                      </form>
                      <ConfirmButton action={deleteEquipment} confirmText="确定要删除该设备吗？如果有关联件号将自动转为下架状态。" className="text-xs text-red-600" id={String(e.id)}>删除</ConfirmButton>
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
