export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { deleteEquipment, toggleEquipmentStatus } from "../actions";
import ConfirmButton from "./ConfirmButton";
import Pagination from "@/components/Pagination";

export default async function AdminEquipmentPage({ searchParams }: { searchParams: { q?: string; page?: string; pageSize?: string; brandId?: string; type?: string; status?: string } }) {
  const q = (searchParams.q || "").trim();
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [20, 50, 100].includes(parseInt(searchParams.pageSize || "20")) ? parseInt(searchParams.pageSize || "20") : 20;
  const brandId = searchParams.brandId ? parseInt(searchParams.brandId) : null;
  const type = searchParams.type || "";
  const status = searchParams.status || "";

  const where: any = {};
  if (q) where.OR = [{ model: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { nameEn: { contains: q, mode: "insensitive" } }, { brand: { name: { contains: q, mode: "insensitive" } } }];
  if (brandId) where.brandId = brandId;
  if (type) where.equipmentType = type;
  if (status) where.status = status;

  const [items, total, brands, types] = await Promise.all([
    prisma.equipment.findMany({ where, include: { brand: true, _count: { select: { partNumbers: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.equipment.count({ where }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.equipment.findMany({ distinct: ["equipmentType"], select: { equipmentType: true }, orderBy: { equipmentType: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const f = "border rounded px-3 py-2 text-sm";
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">设备管理</h1>
        <a href="/admin/equipment/new" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">+ 新增设备</a>
      </div>
      <form method="GET" className="bg-white rounded-lg border p-3 mb-4 flex gap-2 flex-wrap items-end">
        <input name="q" defaultValue={q} placeholder="型号 / 名称 / 品牌" className={`${f} flex-1 min-w-[200px]`} />
        <select name="brandId" className={f}>
          <option value="">全部品牌</option>
          {brands.map((b) => <option key={b.id} value={b.id} selected={brandId === b.id}>{b.name}</option>)}
        </select>
        <select name="type" className={f}>
          <option value="">全部类型</option>
          {types.map((t) => <option key={t.equipmentType} value={t.equipmentType} selected={type === t.equipmentType}>{t.equipmentType}</option>)}
        </select>
        <select name="status" className={f}>
          <option value="">全部状态</option>
          <option value="ACTIVE" selected={status === "ACTIVE"}>启用</option>
          <option value="OFFLINE" selected={status === "OFFLINE"}>下架</option>
        </select>
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">搜索</button>
        <a href="/admin/equipment" className="border px-4 py-2 rounded text-sm">重置</a>
      </form>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr><th className="text-left p-3">缩略图</th><th className="text-left p-3">品牌</th><th className="text-left p-3">型号</th><th className="text-left p-3">名称</th><th className="text-left p-3">类型</th><th className="text-left p-3">状态</th><th className="text-left p-3">件号数</th><th className="text-left p-3">操作</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? <tr><td colSpan={8} className="p-6 text-center text-gray-500">暂无符合条件的设备</td></tr> :
              items.map((e) => (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{e.imageUrl ? <img src={e.imageUrl} className="h-10 w-16 object-cover rounded" /> : <span className="text-xs text-gray-400">暂无图片</span>}</td>
                  <td className="p-3">{e.brand.name}</td>
                  <td className="p-3 font-medium">{e.model}</td>
                  <td className="p-3">{e.name}</td>
                  <td className="p-3">{e.equipmentType}</td>
                  <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded ${e.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{e.status === "ACTIVE" ? "启用" : "下架"}</span></td>
                  <td className="p-3">{e._count.partNumbers}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <a href={`/equipment/${e.slug}`} target="_blank" className="text-xs text-gray-600">查看</a>
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
