export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updateBrand } from "../../actions";

export default async function BrandEdit({ params }: { params: { id: string } }) {
  const b = await prisma.brand.findUnique({ where: { id: parseInt(params.id) } });
  if (!b) notFound();
  const f = "border rounded px-3 py-2 text-sm w-full";

  return (
    <div className="p-6 max-w-2xl">
      <a href="/admin/brands" className="text-sm text-blue-600 hover:underline">← 返回品牌列表</a>
      <h1 className="text-2xl font-bold mt-4 mb-6">编辑品牌：{b.name}</h1>
      <form action={async (fd) => { "use server"; await updateBrand(b.id, fd); }} className="bg-white rounded-lg border p-6 space-y-4">
        <div><label className="block text-sm mb-1">品牌名</label><input name="name" defaultValue={b.name} required className={f} /></div>
        <div><label className="block text-sm mb-1">英文名</label><input name="nameEn" defaultValue={b.nameEn || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">国家</label><input name="country" defaultValue={b.country || ""} className={f} /></div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">保存</button>
      </form>
    </div>
  );
}
