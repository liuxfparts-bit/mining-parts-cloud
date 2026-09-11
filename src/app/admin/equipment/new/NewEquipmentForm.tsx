"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "./ImageUploader";
import SearchableBrandSelect from "./SearchableBrandSelect";
import BrandCreateModal from "./BrandCreateModal";

type Brand = { id: number; name: string; nameEn?: string | null };

export default function NewEquipmentForm({ brands: initialBrands }: { brands: Brand[] }) {
  const router = useRouter();
  const [brands, setBrands] = useState(initialBrands);
  const [brandId, setBrandId] = useState<number | "">(initialBrands[0]?.id || "");
  const [showModal, setShowModal] = useState(false);

  async function onCreated(b: Brand) {
    setBrands((prev) => [...prev, b]);
    setBrandId(b.id);
    setShowModal(false);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("brandId", String(brandId));
    const r = await fetch("/api/admin/equipment/new", { method: "POST", body: fd });
    if (r.ok) router.push("/admin/equipment");
    else alert("保存失败");
  }

  return (
    <>
      <form onSubmit={submit} className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">品牌</label>
          <div className="flex gap-2">
            <div className="flex-1"><SearchableBrandSelect brands={brands} value={brandId} onChange={setBrandId} name="brandId" /></div>
            <button type="button" onClick={() => setShowModal(true)} className="px-3 py-2 text-sm border rounded whitespace-nowrap">+ 新建品牌</button>
          </div>
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
        <div><label className="block text-sm mb-1">Slug（可选）</label><input name="slug" placeholder="mb670-1" className="border rounded px-3 py-2 text-sm w-full" /></div>
        <div><label className="block text-sm mb-1">设备图片</label><ImageUploader /></div>
        <div><label className="block text-sm mb-1">简介</label><textarea name="description" rows={3} className="border rounded px-3 py-2 text-sm w-full" /></div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">保存设备</button>
      </form>
      {showModal && <BrandCreateModal onCreated={onCreated} onClose={() => setShowModal(false)} />}
    </>
  );
}
