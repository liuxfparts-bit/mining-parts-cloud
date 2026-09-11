export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { createEquipment, quickCreateBrand } from "../../actions";
import ImageUploader from "../[id]/edit/ImageUploader";

export default async function NewEquipmentPage() {
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">新增设备</h1>
      <form action={async (fd) => { "use server"; await createEquipment(fd); redirect("/admin/equipment"); }} className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">品牌</label>
          <select name="brandId" required className="border rounded px-3 py-2 text-sm w-full">
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm mb-1">型号 *</label><input name="model" required className="border rounded px-3 py-2 text-sm w-full" /></div>
          <div><label className="block text-sm mb-1">设备名 *</label><input name="name" required className="border rounded px-3 py-2 text-sm w-full" /></div>
          <div><label className="block text-sm mb-1">英文名</label><input name="nameEn" className="border rounded px-3 py-2 text-sm w-full" /></div>
          <div><label className="block text-sm mb-1">系列</label><input name="series" className="border rounded px-3 py-2 text-sm w-full" /></div>
          <div><label className="block text-sm mb-1">设备类型 *</label><input name="equipmentType" required className="border rounded px-3 py-2 text-sm w-full" placeholder="LHD / Bolter Miner / Shuttle Car" /></div>
          <div><label className="block text-sm mb-1">应用场景</label><input name="application" className="border rounded px-3 py-2 text-sm w-full" /></div>
          <div><label className="block text-sm mb-1">矿山类型</label><input name="mineType" className="border rounded px-3 py-2 text-sm w-full" /></div>
          <div><label className="block text-sm mb-1">制造商</label><input name="manufacturer" className="border rounded px-3 py-2 text-sm w-full" /></div>
        </div>
        <div><label className="block text-sm mb-1">Slug（可选，留空自动生成）</label><input name="slug" placeholder="mb670-1" className="border rounded px-3 py-2 text-sm w-full" /></div>
        <div><label className="block text-sm mb-1">设备图片</label><ImageUploader /></div>
        <div><label className="block text-sm mb-1">简介</label><textarea name="description" rows={3} className="border rounded px-3 py-2 text-sm w-full" /></div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">保存设备</button>
      </form>

      <div className="mt-8 border-t pt-6">
        <h2 className="font-bold mb-2">没有合适的品牌？</h2>
        <form action={async (fd) => { "use server"; const r = await quickCreateBrand(fd.get("name") as string, fd.get("nameEn") as string || undefined); if (r.error) throw new Error(r.error); redirect("/admin/equipment/new"); }} className="bg-gray-50 border rounded p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input name="name" placeholder="品牌名（必填）" required className="border rounded px-3 py-2 text-sm" />
            <input name="nameEn" placeholder="英文名" className="border rounded px-3 py-2 text-sm" />
          </div>
          <button className="text-sm bg-green-600 text-white px-4 py-2 rounded">保存品牌并刷新</button>
        </form>
      </div>
    </div>
  );
}
