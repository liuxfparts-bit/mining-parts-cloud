export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { createPartNumber, reviewPartNumber } from "../actions";

export default async function AdminPartNumbersPage() {
  const items = await prisma.partNumber.findMany({
    include: { brand: true, equipment: true, _count: { select: { products: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const brands = await prisma.brand.findMany();
  const equipments = await prisma.equipment.findMany();

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">件号管理</h1>
        <span className="text-sm text-gray-500">共 {items.length} 条</span>
      </div>

      <form action={createPartNumber} className="bg-white rounded-lg border p-4 mb-4 flex gap-2 items-end flex-wrap">
        <input name="number" placeholder="件号 (如 XP210162)" required className="border rounded px-3 py-2 text-sm" />
        <input name="name" placeholder="名称" required className="border rounded px-3 py-2 text-sm" />
        <select name="brandId" className="border rounded px-3 py-2 text-sm">
          <option value="">选品牌</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select name="equipmentId" className="border rounded px-3 py-2 text-sm">
          <option value="">选设备</option>
          {equipments.map((e) => <option key={e.id} value={e.id}>{e.model}</option>)}
        </select>
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">新增件号</button>
      </form>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">件号</th>
              <th className="text-left p-3">名称</th>
              <th className="text-left p-3">品牌</th>
              <th className="text-left p-3">设备</th>
              <th className="text-left p-3">产品数</th>
              <th className="text-left p-3">验证</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono font-medium">
                  <a href={`/admin/part-numbers/${p.id}`} className="text-blue-600 hover:underline">{p.number}</a>
                </td>
                <td className="p-3">{p.name}</td>
                <td className="p-3">{p.brand?.name || "-"}</td>
                <td className="p-3">{p.equipment?.model || "-"}</td>
                <td className="p-3">{p._count.products}</td>
                <td className="p-3">
                  <form action={async () => { "use server"; await reviewPartNumber(p.id, !p.verified); }}>
                    <button className={`text-xs px-2 py-1 rounded ${p.verified ? "bg-green-100 text-green-700" : "bg-gray-100"}`}>
                      {p.verified ? "✓ 已验证" : "点验证"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
