"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "./ImageUploader";
import SearchableBrandSelect from "./SearchableBrandSelect";
import BrandCreateModal from "./BrandCreateModal";

type Brand = { id: number; name: string; nameEn?: string | null };

export default function EditEquipmentForm({ id, brands, initial }: { id: number; brands: Brand[]; initial: Record<string, any> }) {
  const router = useRouter();
  const [allBrands, setAllBrands] = useState(brands);
  const [brandId, setBrandId] = useState<number | "">(initial.brandId || "");
  const [showModal, setShowModal] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("brandId", String(brandId));
    const r = await fetch(`/api/admin/equipment/${id}`, { method: "POST", body: fd });
    if (r.ok) router.push("/admin/equipment");
    else alert("保存失败");
  }

  const f = "border rounded px-3 py-2 text-sm w-full";
  return (
    <>
      <form onSubmit={submit} className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">品牌</label>
          <div className="flex gap-2">
            <div className="flex-1"><SearchableBrandSelect brands={allBrands} value={brandId} onChange={setBrandId} name="brandId" /></div>
            <button type="button" onClick={() => setShowModal(true)} className="px-3 py-2 text-sm border rounded whitespace-nowrap">+ 新建品牌</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm mb-1">型号</label><input name="model" required defaultValue={initial.model} className={f} /></div>
          <div><label className="block text-sm mb-1">设备名</label><input name="name" required defaultValue={initial.name} className={f} /></div>
          <div><label className="block text-sm mb-1">英文名</label><input name="nameEn" defaultValue={initial.nameEn || ""} className={f} /></div>
          <div><label className="block text-sm mb-1">系列</label><input name="series" defaultValue={initial.series || ""} className={f} /></div>
          <div><label className="block text-sm mb-1">类型</label><input name="equipmentType" required defaultValue={initial.equipmentType} className={f} /></div>
          <div><label className="block text-sm mb-1">应用场景</label><input name="application" defaultValue={initial.application || ""} className={f} /></div>
          <div><label className="block text-sm mb-1">矿山类型</label><input name="mineType" defaultValue={initial.mineType || ""} className={f} /></div>
          <div><label className="block text-sm mb-1">制造商</label><input name="manufacturer" defaultValue={initial.manufacturer || ""} className={f} /></div>
        </div>
        <div><label className="block text-sm mb-1">设备图片</label><ImageUploader initialUrl={initial.imageUrl || ""} /></div>
        <div><label className="block text-sm mb-1">简介</label><textarea name="description" defaultValue={initial.description || ""} rows={3} className={f} /></div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">保存修改</button>
      </form>
      {showModal && (
        <BrandCreateModal
          onCreated={(b) => { setAllBrands((prev) => [...prev, b]); setBrandId(b.id); setShowModal(false); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
