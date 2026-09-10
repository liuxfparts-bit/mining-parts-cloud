export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

async function resubmit(formData: FormData) {
  "use server";
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");
  const id = parseInt(formData.get("id") as string);
  const req = await prisma.partNumberRequest.findUnique({ where: { id } });
  if (!req || req.supplierId !== user.supplierId) notFound();
  await prisma.partNumberRequest.update({
    where: { id },
    data: {
      partName: formData.get("partName") as string,
      brandName: (formData.get("brandName") as string) || null,
      equipmentModel: (formData.get("equipmentModel") as string) || null,
      categoryId: formData.get("categoryId") ? parseInt(formData.get("categoryId") as string) : null,
      description: (formData.get("description") as string) || null,
      status: "PENDING",
      reviewReason: null,
    },
  });
  redirect("/supplier/part-number-requests");
}

export default async function EditRequest({ params }: { params: { id: string } }) {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");
  const req = await prisma.partNumberRequest.findUnique({ where: { id: parseInt(params.id) } });
  if (!req || req.supplierId !== user.supplierId) notFound();
  const parents = await prisma.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" }, include: { children: { orderBy: { sortOrder: "asc" } } } });
  const f = "border rounded px-3 py-2 text-sm w-full";
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">修改并重新提交</h1>
      <Link href="/supplier/part-number-requests" className="text-sm text-blue-600">← 返回</Link>
      {req.status === "REJECTED" && req.reviewReason && (
        <div className="bg-red-50 text-red-700 p-3 rounded my-3 text-sm">上次驳回：{req.reviewReason}</div>
      )}
      <form action={resubmit} className="bg-white p-6 rounded-lg border space-y-3 mt-3">
        <input type="hidden" name="id" value={req.id} />
        <div><label className="block text-sm mb-1">件号</label><input value={req.partNumber} disabled className={f + " bg-gray-50"} /></div>
        <div><label className="block text-sm mb-1">件号名称 *</label><input name="partName" required defaultValue={req.partName} className={f} /></div>
        <div><label className="block text-sm mb-1">品牌</label><input name="brandName" defaultValue={req.brandName || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">适用设备</label><input name="equipmentModel" defaultValue={req.equipmentModel || ""} className={f} /></div>
        <div>
          <label className="block text-sm mb-1">一级分类</label>
          <select name="categoryId" className={f} defaultValue={req.categoryId || ""}>
            <option value="">不选</option>
            {parents.map((p) => (
              <optgroup key={p.id} label={p.name}>
                <option value={p.id}>{p.name}</option>
                {p.children.map((c) => <option key={c.id} value={c.id}>└ {c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div><label className="block text-sm mb-1">备注</label><textarea name="description" rows={3} defaultValue={req.description || ""} className={f} /></div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">重新提交审核</button>
      </form>
    </div>
  );
}
