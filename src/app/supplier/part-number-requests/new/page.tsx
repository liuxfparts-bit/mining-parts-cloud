export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

async function submit(formData: FormData) {
  "use server";
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");
  await prisma.partNumberRequest.create({
    data: {
      supplierId: user.supplierId,
      partNumber: (formData.get("partNumber") as string).toUpperCase(),
      partName: formData.get("partName") as string,
      brandName: (formData.get("brandName") as string) || null,
      equipmentModel: (formData.get("equipmentModel") as string) || null,
      category: (formData.get("category") as string) || null,
      description: (formData.get("description") as string) || null,
    },
  });
  redirect("/supplier/part-number-requests");
}

export default function NewRequest({ searchParams }: { searchParams: { partNumber?: string } }) {
  const f = "border rounded px-3 py-2 text-sm w-full";
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">申请新增件号</h1>
      <form action={submit} className="bg-white p-6 rounded-lg border space-y-3">
        <div className="bg-gray-50 p-3 rounded text-sm">提交后等待 Admin 审核，通过后即可发布产品。</div>
        <div><label className="block text-sm mb-1">件号 *</label><input name="partNumber" required defaultValue={searchParams.partNumber || ""} className={f} /></div>
        <div><label className="block text-sm mb-1">件号名称 *</label><input name="partName" required className={f} /></div>
        <div><label className="block text-sm mb-1">品牌</label><input name="brandName" className={f} /></div>
        <div><label className="block text-sm mb-1">适用设备</label><input name="equipmentModel" className={f} /></div>
        <div><label className="block text-sm mb-1">分类</label><input name="category" className={f} /></div>
        <div><label className="block text-sm mb-1">备注</label><textarea name="description" rows={3} className={f} /></div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">提交申请</button>
      </form>
    </div>
  );
}
