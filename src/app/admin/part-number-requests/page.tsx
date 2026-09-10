export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

async function approve(formData: FormData) {
  "use server";
  const id = parseInt(formData.get("id") as string);
  const req = await prisma.partNumberRequest.findUnique({ where: { id } });
  if (!req) return;
  const existing = await prisma.partNumber.findUnique({ where: { slug: req.partNumber.toLowerCase() } });
  if (!existing) {
    await prisma.partNumber.create({
      data: {
        number: req.partNumber,
        name: req.partName,
        slug: req.partNumber.toLowerCase(),
        category: req.category || "通用",
      },
    });
  }
  await prisma.partNumberRequest.update({ where: { id }, data: { status: "APPROVED" } });
}
async function reject(formData: FormData) {
  "use server";
  const id = parseInt(formData.get("id") as string);
  await prisma.partNumberRequest.update({ where: { id }, data: { status: "REJECTED", reviewReason: "不符合" } });
}

export default async function AdminPartNumberRequests() {
  const list = await prisma.partNumberRequest.findMany({ include: { supplier: true }, orderBy: { createdAt: "desc" } });
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">件号申请审核</h1>
      <table className="w-full bg-white border rounded-lg text-sm">
        <thead className="bg-gray-50"><tr>
          <th className="text-left p-3">件号</th><th className="text-left p-3">名称</th><th className="text-left p-3">供应商</th>
          <th className="text-left p-3">品牌</th><th className="text-left p-3">设备</th><th className="text-left p-3">状态</th><th></th>
        </tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-3 font-mono">{r.partNumber}</td>
              <td className="p-3">{r.partName}</td>
              <td className="p-3">{r.supplier.name}</td>
              <td className="p-3">{r.brandName}</td>
              <td className="p-3">{r.equipmentModel}</td>
              <td className="p-3">{r.status}</td>
              <td className="p-3">
                {r.status === "PENDING" && (
                  <div className="flex gap-2">
                    <form action={approve}><input type="hidden" name="id" value={r.id} /><button className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">通过</button></form>
                    <form action={reject}><input type="hidden" name="id" value={r.id} /><button className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">驳回</button></form>
                  </div>
                )}
                {r.status === "APPROVED" && (
                  <a href={`/supplier/products/new?partNumber=${r.partNumber}`} className="text-blue-600 text-xs" target="_blank">发布产品</a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
