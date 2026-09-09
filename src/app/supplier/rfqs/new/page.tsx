export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { createRfq } from "../../actions";

export default async function NewRfq() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const partNumbers = await prisma.partNumber.findMany({ orderBy: { number: "asc" }, take: 500 });

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">发布采购询价</h1>
      <form action={createRfq} className="bg-white rounded-lg border p-6 space-y-4">
        <div><label className="block text-sm mb-1">标题</label><input name="title" required className="border rounded px-3 py-2 text-sm w-full" placeholder="如：采购 XP210162 导向件 16 件" /></div>
        <div>
          <label className="block text-sm mb-1">关联件号</label>
          <select name="partNumberId" className="border rounded px-3 py-2 text-sm w-full">
            <option value="">不指定</option>
            {partNumbers.map((p) => <option key={p.id} value={p.id}>{p.number}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm mb-1">数量</label><input name="quantity" type="number" step="0.01" required className="border rounded px-3 py-2 text-sm w-full" /></div>
          <div><label className="block text-sm mb-1">单位</label><input name="unit" defaultValue="pcs" className="border rounded px-3 py-2 text-sm w-full" /></div>
        </div>
        <div><label className="block text-sm mb-1">交货地点</label><input name="deliveryLocation" className="border rounded px-3 py-2 text-sm w-full" /></div>
        <div><label className="block text-sm mb-1">联系人</label><input name="contactName" required className="border rounded px-3 py-2 text-sm w-full" /></div>
        <div><label className="block text-sm mb-1">联系电话</label><input name="contactPhone" required className="border rounded px-3 py-2 text-sm w-full" /></div>
        <div><label className="block text-sm mb-1">描述</label><textarea name="description" rows={3} className="border rounded px-3 py-2 text-sm w-full" /></div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">发布询价</button>
      </form>
    </div>
  );
}
