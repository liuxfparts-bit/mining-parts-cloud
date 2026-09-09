export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updateSupplier } from "../../../actions";

export default async function SupplierEdit({ params }: { params: { id: string } }) {
  const s = await prisma.supplier.findUnique({ where: { id: parseInt(params.id) } });
  if (!s) notFound();

  const field = "border rounded px-3 py-2 text-sm w-full";
  const label = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="p-6 max-w-3xl">
      <a href={`/admin/suppliers/${s.id}`} className="text-sm text-blue-600 hover:underline">← 返回详情</a>
      <h1 className="text-2xl font-bold mt-4 mb-6">编辑企业：{s.name}</h1>

      <form action={async (fd) => { "use server"; await updateSupplier(s.id, fd); }} className="bg-white rounded-lg border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className={label}>企业全称</label><input name="name" defaultValue={s.name} className={field} /></div>
          <div><label className={label}>英文名</label><input name="nameEn" defaultValue={s.nameEn || ""} className={field} /></div>
          <div><label className={label}>简称</label><input name="shortName" defaultValue={s.shortName || ""} className={field} /></div>
          <div><label className={label}>联系人</label><input name="contactName" defaultValue={s.contactName || ""} className={field} /></div>
          <div><label className={label}>职位</label><input name="position" defaultValue={s.position || ""} className={field} /></div>
          <div><label className={label}>手机</label><input name="mobile" defaultValue={s.mobile || ""} className={field} /></div>
          <div><label className={label}>电话</label><input name="telephone" defaultValue={s.telephone || ""} className={field} /></div>
          <div><label className={label}>邮箱</label><input name="email" defaultValue={s.email || ""} className={field} /></div>
          <div><label className={label}>微信</label><input name="wechat" defaultValue={s.wechat || ""} className={field} /></div>
          <div><label className={label}>WhatsApp</label><input name="whatsapp" defaultValue={s.whatsapp || ""} className={field} /></div>
          <div><label className={label}>官网</label><input name="website" defaultValue={s.website || ""} className={field} /></div>
          <div><label className={label}>省</label><input name="province" defaultValue={s.province || ""} className={field} /></div>
          <div><label className={label}>市</label><input name="city" defaultValue={s.city || ""} className={field} /></div>
          <div><label className={label}>地址</label><input name="address" defaultValue={s.address || ""} className={field} /></div>
          <div><label className={label}>主营业务</label><input name="mainBusiness" defaultValue={s.mainBusiness} className={field} /></div>
          <div><label className={label}>主营品牌</label><input name="mainBrands" defaultValue={s.mainBrands || ""} className={field} /></div>
          <div><label className={label}>主营设备</label><input name="mainEquipment" defaultValue={s.mainEquipment || ""} className={field} /></div>
          <div>
            <label className={label}>会员等级</label>
            <select name="memberLevel" className={field} defaultValue={s.memberLevel}>
              <option>FREE</option><option>BRONZE</option><option>SILVER</option><option>GOLD</option>
            </select>
          </div>
          <div>
            <label className={label}>认证状态</label>
            <select name="verifiedStatus" className={field} defaultValue={s.verifiedStatus}>
              <option>PENDING</option><option>VERIFIED</option><option>REJECTED</option>
            </select>
          </div>
        </div>
        <div>
          <label className={label}>企业简介</label>
          <textarea name="description" rows={4} defaultValue={s.description || ""} className={field} />
        </div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">保存修改</button>
      </form>
    </div>
  );
}
