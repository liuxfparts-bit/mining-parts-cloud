"use client";

import { useState } from "react";

type Cat = { id: number; name: string; children?: { id: number; name: string }[] };

export default function RequestForm({ parents, defaultPartNumber, submitAction }: { parents: Cat[]; defaultPartNumber: string; submitAction: (fd: FormData) => Promise<void> }) {
  const [pid, setPid] = useState<number | "">("");
  const parent = parents.find((p) => p.id === pid);
  const f = "border rounded px-3 py-2 text-sm w-full";
  return (
    <form action={submitAction} className="bg-white p-6 rounded-lg border space-y-3">
      <div className="bg-gray-50 p-3 rounded text-sm">提交后等待 Admin 审核，通过后即可发布产品。</div>
      <div><label className="block text-sm mb-1">件号 *</label><input name="partNumber" required defaultValue={defaultPartNumber} className={f} /></div>
      <div><label className="block text-sm mb-1">件号名称 *</label><input name="partName" required className={f} /></div>
      <div><label className="block text-sm mb-1">品牌</label><input name="brandName" className={f} /></div>
      <div><label className="block text-sm mb-1">适用设备</label><input name="equipmentModel" className={f} /></div>
      <div>
        <label className="block text-sm mb-1">一级分类 *</label>
        <select required value={pid} onChange={(e) => setPid(parseInt(e.target.value))} className={f}>
          <option value="">选择分类</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {parent && (
        <div>
          <label className="block text-sm mb-1">二级分类（选填）</label>
          <select name="categoryId" className={f}>
            <option value="">不选</option>
            {parent.children?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      {!parent && <input type="hidden" name="categoryId" value="" />}
      <div><label className="block text-sm mb-1">备注</label><textarea name="description" rows={3} className={f} /></div>
      <button className="bg-blue-600 text-white px-6 py-2 rounded">提交申请</button>
    </form>
  );
}
