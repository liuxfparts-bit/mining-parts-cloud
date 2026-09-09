export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

export default async function AdminSuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { createdAt: "desc" },
  });
  const MEMBER: Record<string, string> = { FREE: "普通会员", BRONZE: "铜牌", SILVER: "银牌", GOLD: "金牌" };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">企业管理</h1>
        <span className="text-sm text-gray-500">共 {suppliers.length} 家企业</span>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">企业名称</th>
              <th className="text-left p-3">地区</th>
              <th className="text-left p-3">产品数</th>
              <th className="text-left p-3">认证状态</th>
              <th className="text-left p-3">会员等级</th>
              <th className="text-left p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{s.id}</td>
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3">{s.province || "-"}</td>
                <td className="p-3">{s._count.products}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${s.verifiedStatus === "VERIFIED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {s.verifiedStatus}
                  </span>
                </td>
                <td className="p-3">{MEMBER[s.memberLevel] || s.memberLevel}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <a href={`/admin/suppliers/${s.id}`} className="text-blue-600 hover:underline text-xs">查看</a>
                    <a href={`/admin/suppliers/${s.id}/edit`} className="text-blue-600 hover:underline text-xs">编辑</a>
                    {s.verifiedStatus === "PENDING" && (
                      <a href={`/admin/suppliers/${s.id}`} className="text-green-600 hover:underline text-xs">审核</a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
