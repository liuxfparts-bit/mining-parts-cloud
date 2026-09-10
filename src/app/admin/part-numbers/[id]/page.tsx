export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updatePartNumber } from "../../actions";

export default async function PartNumberEdit({ params }: { params: { id: string } }) {
  const p = await prisma.partNumber.findUnique({ where: { id: parseInt(params.id) } });
  if (!p) notFound();
  const f = "border rounded px-3 py-2 text-sm w-full";

  return (
    <div className="p-6 max-w-2xl">
      <a href="/admin/part-numbers" className="text-sm text-blue-600 hover:underline">← 返回件号列表</a>
      <h1 className="text-2xl font-bold mt-4 mb-6">编辑件号：{p.number}</h1>
      <form action={async (fd) => { "use server"; await updatePartNumber(p.id, fd); }} className="bg-white rounded-lg border p-6 space-y-4">
        <div><label className="block text-sm mb-1">件号</label><input defaultValue={p.number} readOnly className={f + " bg-gray-50"} /></div>
        <div><label className="block text-sm mb-1">名称</label><input name="name" defaultValue={p.name} required className={f} /></div>
        <div><label className="block text-sm mb-1">规格</label><input name="specification" defaultValue={p.specification || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">应用</label><input name="application" defaultValue={p.application || ""} className={f} /></div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">保存</button>
      </form>
    </div>
  );
}
