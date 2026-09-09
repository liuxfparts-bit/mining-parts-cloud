"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCompany } from "../../../actions";

type Supplier = {
  id: number;
  name: string;
  nameEn: string | null;
  shortName: string | null;
  contactName: string | null;
  position: string | null;
  mobile: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  wechat: string | null;
  whatsapp: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  mainBusiness: string;
  mainBrands: string | null;
  mainEquipment: string | null;
  description: string | null;
  memberLevel: string;
  verifiedStatus: string;
};

export default function SupplierEditClient({ supplier }: { supplier: Supplier }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const readonly = supplier.verifiedStatus === "VERIFIED";
  const field = "border rounded px-3 py-2 text-sm w-full";
  const ro = field + " bg-gray-50 text-gray-500";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const fd = new FormData(e.currentTarget);
    try {
      await updateCompany(String(supplier.id), fd);
      setMsg("企业信息修改成功");
      router.push("/admin/suppliers");
      router.refresh();
    } catch (err: any) {
      setMsg("保存失败: " + (err.message || "未知错误"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
      {msg && <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded text-sm">{msg}</div>}
      {readonly && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded text-sm">
          已审核企业，基础资料只读，仅会员等级可修改。
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium mb-1">企业全称</label><input name="name" defaultValue={supplier.name} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">英文名</label><input name="nameEn" defaultValue={supplier.nameEn || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">联系人</label><input name="contactName" defaultValue={supplier.contactName || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">职位</label><input name="position" defaultValue={supplier.position || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">手机</label><input name="mobile" defaultValue={supplier.mobile || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">电话</label><input name="telephone" defaultValue={supplier.telephone || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">邮箱</label><input name="email" defaultValue={supplier.email || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">微信</label><input name="wechat" defaultValue={supplier.wechat || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">WhatsApp</label><input name="whatsapp" defaultValue={supplier.whatsapp || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">官网</label><input name="website" defaultValue={supplier.website || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">省</label><input name="province" defaultValue={supplier.province || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">市</label><input name="city" defaultValue={supplier.city || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">地址</label><input name="address" defaultValue={supplier.address || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">主营业务</label><input name="mainBusiness" defaultValue={supplier.mainBusiness} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">主营品牌</label><input name="mainBrands" defaultValue={supplier.mainBrands || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div><label className="block text-sm font-medium mb-1">主营设备</label><input name="mainEquipment" defaultValue={supplier.mainEquipment || ""} readOnly={readonly} className={readonly ? ro : field} /></div>
        <div>
          <label className="block text-sm font-medium mb-1">会员等级</label>
          <select name="memberLevel" className={field} defaultValue={supplier.memberLevel}>
            <option value="FREE">普通会员</option>
            <option value="BRONZE">铜牌会员</option>
            <option value="SILVER">银牌会员</option>
            <option value="GOLD">金牌会员</option>
          </select>
        </div>
        {!readonly && (
          <div>
            <label className="block text-sm font-medium mb-1">认证状态</label>
            <select name="verifiedStatus" className={field} defaultValue={supplier.verifiedStatus}>
              <option>PENDING</option><option>VERIFIED</option><option>REJECTED</option>
            </select>
          </div>
        )}
      </div>
      {!readonly && (
        <div>
          <label className="block text-sm font-medium mb-1">企业简介</label>
          <textarea name="description" rows={3} defaultValue={supplier.description || ""} className={field} />
        </div>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50">
          {loading ? "保存中..." : "保存修改"}
        </button>
        <button type="button" onClick={() => router.push("/admin/suppliers")} className="px-6 py-2 rounded border">取消</button>
      </div>
    </form>
  );
}
