"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: number;
  name: string;
  contactName: string | null;
  mobile: string | null;
  telephone: string | null;
  email: string | null;
  wechat: string | null;
  whatsapp: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  mainBusiness: string;
  mainBrands: string | null;
  mainEquipment: string | null;
  description: string | null;
  verifiedStatus: string;
};

export default function SupplierProfileClient({ supplier }: { supplier: Props }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const f = "border rounded px-3 py-2 text-sm w-full";
  const ro = f + " bg-gray-50 text-gray-500";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/supplier/profile`, {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(fd)),
    });
    const data = await res.json();
    setMsg(data.message || "");
    setLoading(false);
    if (data.success) router.push("/supplier");
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
      {msg && <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded text-sm">{msg}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm mb-1">企业名称（不可改）</label><input name="name" defaultValue={supplier.name} readOnly className={ro} /></div>
        <div><label className="block text-sm mb-1">联系人</label><input name="contactName" defaultValue={supplier.contactName || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">手机</label><input name="mobile" defaultValue={supplier.mobile || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">电话</label><input name="telephone" defaultValue={supplier.telephone || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">邮箱</label><input name="email" defaultValue={supplier.email || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">微信</label><input name="wechat" defaultValue={supplier.wechat || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">WhatsApp</label><input name="whatsapp" defaultValue={supplier.whatsapp || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">省</label><input name="province" defaultValue={supplier.province || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">市</label><input name="city" defaultValue={supplier.city || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">地址</label><input name="address" defaultValue={supplier.address || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">主营业务</label><input name="mainBusiness" defaultValue={supplier.mainBusiness} className={f} /></div>
        <div><label className="block text-sm mb-1">主营品牌</label><input name="mainBrands" defaultValue={supplier.mainBrands || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">主营设备</label><input name="mainEquipment" defaultValue={supplier.mainEquipment || ""} className={f} /></div>
      </div>
      <div><label className="block text-sm mb-1">简介</label><textarea name="description" rows={3} defaultValue={supplier.description || ""} className={f} /></div>
      <div className="h-16" />
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-3 flex justify-end gap-2 shadow">
        <button type="reset" className="border px-4 py-2 rounded text-sm">撤销</button>
        <button disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50">
          {loading ? "保存中..." : "保存修改"}
        </button>
      </div>
    </form>
  );
}
