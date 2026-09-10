export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { createRfq } from "../../../supplier/actions";

export default async function NewBuyerRfq() {
  const s = await auth();
  if (!s) redirect("/login");
  const partNumbers = await prisma.partNumber.findMany({ orderBy: { number: "asc" }, take: 500 });
  const f = "border rounded px-3 py-2 text-sm w-full";

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">发起询价</h1>
      <form action={createRfq} className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">询价标题 *</label>
          <input name="title" required className={f} placeholder="如：采购 XP210162 导向件" />
        </div>
        <div>
          <label className="block text-sm mb-1">关联件号</label>
          <select name="partNumberId" className={f}>
            <option value="">不关联/自由文本</option>
            {partNumbers.map((p) => (
              <option key={p.id} value={p.id}>{p.number} - {p.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">数量 *</label>
            <input name="quantity" type="number" defaultValue={1} min={1} required className={f} />
          </div>
          <div>
            <label className="block text-sm mb-1">单位</label>
            <input name="unit" defaultValue="pcs" className={f} />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">交货地点</label>
          <input name="deliveryLocation" className={f} placeholder="如：中国山西朔州" />
        </div>
        <div>
          <label className="block text-sm mb-1">联系人 *</label>
          <input name="contactName" required defaultValue={(s.user as any).name || ""} className={f} />
        </div>
        <div>
          <label className="block text-sm mb-1">联系电话 *</label>
          <input name="contactPhone" required className={f} />
        </div>
        <div>
          <label className="block text-sm mb-1">描述</label>
          <textarea name="description" rows={4} className={f} placeholder="详细说明需求：品牌、型号、技术要求、交期等" />
        </div>
        <div>
          <label className="block text-sm mb-1">图片（选填，粘贴图片 URL）</label>
          <input name="images" className={f} placeholder="https://..." />
          <p className="text-xs text-gray-400 mt-1">可上传示意图/图纸后粘贴 URL，多张用逗号分隔</p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">提交询价</button>
      </form>
    </div>
  );
}
