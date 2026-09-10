export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { approvePartNumberRequest, rejectPartNumberRequest } from "../actions";

export default async function AdminPartNumberRequests() {
  const list = await prisma.partNumberRequest.findMany({ include: { supplier: true, category: true }, orderBy: { createdAt: "desc" } });
  const parents = await prisma.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" }, include: { children: { orderBy: { sortOrder: "asc" } } } });
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">件号申请审核</h1>
      <table className="w-full bg-white border rounded-lg text-sm">
        <thead className="bg-gray-50 border-b"><tr>
          <th className="text-left p-3">件号</th><th className="text-left p-3">名称</th><th className="text-left p-3">供应商</th>
          <th className="text-left p-3">品牌</th><th className="text-left p-3">设备</th><th className="text-left p-3">分类</th><th className="text-left p-3">状态</th><th></th>
        </tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-3 font-mono">{r.partNumber}</td>
              <td className="p-3">{r.partName}</td>
              <td className="p-3">{r.supplier.name}</td>
              <td className="p-3">{r.brandName}</td>
              <td className="p-3">{r.equipmentModel}</td>
              <td className="p-3">{r.category?.name || "-"}</td>
              <td className="p-3">{r.status}</td>
              <td className="p-3">
                {r.status !== "APPROVED" && (
                  <div className="flex gap-2 items-center flex-wrap">
                    <form action={approvePartNumberRequest} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={r.id} />
                      <select name="categoryId" defaultValue={r.categoryId || ""} className="text-xs border rounded px-1 py-1">
                        {parents.map((p) => (
                          <optgroup key={p.id} label={p.name}>
                            <option value={p.id}>{p.name}</option>
                            {p.children.map((c) => <option key={c.id} value={c.id}>└ {c.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      <button type="submit" className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">通过</button>
                    </form>
                    <form action={rejectPartNumberRequest} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={r.id} />
                      <input name="reason" placeholder="原因" className="text-xs border rounded px-1 py-1 w-24" />
                      <button type="submit" className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">驳回</button>
                    </form>
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
