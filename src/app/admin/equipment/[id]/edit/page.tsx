export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updateEquipment, deleteEquipment, toggleEquipmentStatus } from "../../../actions";
import ImageUploader from "./ImageUploader";

export default async function EquipmentEdit({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [e, brands] = await Promise.all([
    prisma.equipment.findUnique({ where: { id } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!e) notFound();
  const f = "border rounded px-3 py-2 text-sm w-full";

  return (
    <div className="p-6 max-w-3xl">
      <a href="/admin/equipment" className="text-sm text-blue-600">← 返回设备列表</a>
      <h1 className="text-2xl font-bold mt-4 mb-6">编辑设备：{e.model}</h1>
      <form action={async (fd) => { "use server"; await updateEquipment(id, fd); }} className="bg-white rounded-lg border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm mb-1">品牌</label>
            <select name="brandId" required className={f}>
              {brands.map((b) => <option key={b.id} value={b.id} selected={b.id === e.brandId}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="block text-sm mb-1">型号</label><input name="model" required defaultValue={e.model} className={f} /></div>
          <div><label className="block text-sm mb-1">设备名</label><input name="name" required defaultValue={e.name} className={f} /></div>
          <div><label className="block text-sm mb-1">英文名</label><input name="nameEn" defaultValue={e.nameEn || ""} className={f} /></div>
          <div><label className="block text-sm mb-1">系列</label><input name="series" defaultValue={e.series || ""} className={f} /></div>
          <div><label className="block text-sm mb-1">类型</label><input name="equipmentType" required defaultValue={e.equipmentType} className={f} /></div>
          <div><label className="block text-sm mb-1">应用场景</label><input name="application" defaultValue={e.application || ""} className={f} /></div>
          <div><label className="block text-sm mb-1">状态</label>
            <select name="status" className={f}>
              <option value="ACTIVE" selected={e.status === "ACTIVE"}>启用</option>
              <option value="OFFLINE" selected={e.status === "OFFLINE"}>下架</option>
            </select>
          </div>
        </div>
        <div><label className="block text-sm mb-1">设备图片</label><ImageUploader initialUrl={e.imageUrl || ""} /></div>
        <div><label className="block text-sm mb-1">简介</label><textarea name="description" defaultValue={e.description || ""} rows={3} className={f} /></div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">保存修改</button>
      </form>
      <div className="mt-4 flex gap-2">
        <form action={async () => { "use server"; await toggleEquipmentStatus(id); }}>
          <button className="text-xs px-3 py-1 bg-gray-100">{e.status === "ACTIVE" ? "下架" : "启用"}</button>
        </form>
        <form action={async () => { "use server"; await deleteEquipment(id); }}>
          <button className="text-xs px-3 py-1 bg-red-100 text-red-700">删除/下架</button>
        </form>
      </div>
    </div>
  );
}
