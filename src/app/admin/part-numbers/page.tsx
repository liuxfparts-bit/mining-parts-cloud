export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { createPartNumber, reviewPartNumber } from "../actions";

export default async function AdminPartNumbersPage({ searchParams }: { searchParams: { q?: string; page?: string; pageSize?: string } }) {
  const q = (searchParams.q || "").trim();
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [20, 50, 100].includes(parseInt(searchParams.pageSize || "20")) ? parseInt(searchParams.pageSize || "20") : 20;

  const where = q ? {
    OR: [
      { number: { contains: q, mode: "insensitive" as const } },
      { name: { contains: q, mode: "insensitive" as const } },
      { brand: { name: { contains: q, mode: "insensitive" as const } } },
      { equipment: { model: { contains: q, mode: "insensitive" as const } } },
    ],
  } : {};

  const [items, total, brands, equipments] = await Promise.all([
    prisma.partNumber.findMany({
      where, include: { brand: true, equipment: true, _count: { select: { products: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.partNumber.count({ where }),
    prisma.brand.findMany(),
    prisma.equipment.findMany(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pendingReq = await prisma.partNumberRequest.count({ where: { status: "PENDING" } });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">件号管理</h1>
        <Link href="/admin/part-number-requests" className="text-sm text-blue-600">待审核申请 ({pendingReq})</Link>
      </div>

      <form method="GET" className="bg-white rounded-lg border p-3 mb-4 flex gap-2 items-end flex-wrap">
        <input name="q" defaultValue={q} placeholder="件号 / 名称 / 品牌 / 设备型号" className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">搜索</button>
        <Link href="/admin/part-numbers" className="border px-4 py-2 rounded text-sm">重置</Link>
      </form>

      <form action={createPartNumber} className="bg-white rounded-lg border p-3 mb-4 flex gap-2 items-end flex-wrap">
        <input name="number" placeholder="件号 (如 XP210162)" required className="border rounded px-3 py-2 text-sm" />
        <input name="name" placeholder="名称" required className="border rounded px-3 py-2 text-sm" />
        <select name="brandId" className="border rounded px-3 py-2 text-sm"><option value="">选品牌</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select name="equipmentId" className="border rounded px-3 py-2 text-sm"><option value="">选设备</option>{equipments.map((e) => <option key={e.id} value={e.id}>{e.model}</option>)}</select>
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">新增件号</button>
      </form>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">件号</th><th className="text-left p-3">名称</th><th className="text-left p-3">品牌</th>
              <th className="text-left p-3">设备</th><th className="text-left p-3">产品数</th><th className="text-left p-3">验证</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">暂无匹配件号</td></tr>
            ) : items.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono font-medium"><a href={`/admin/part-numbers/${p.id}`} className="text-blue-600 hover:underline">{p.number}</a></td>
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

      <div className="flex justify-between items-center mt-3 text-sm">
        <span>第 {page} / {totalPages} 页，共 {total} 条</span>
        <div className="flex gap-2">
          <Link href={`?q=${encodeURIComponent(q)}&page=${Math.max(1, page - 1)}&pageSize=${pageSize}`} className="border px-3 py-1 rounded">上一页</Link>
          <Link href={`?q=${encodeURIComponent(q)}&page=${Math.min(totalPages, page + 1)}&pageSize=${pageSize}`} className="border px-3 py-1 rounded">下一页</Link>
        </div>
      </div>
    </div>
  );
}
