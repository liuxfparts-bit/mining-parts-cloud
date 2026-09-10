export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

export default async function AdminUsers() {
  const users = await prisma.user.findMany({
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">所有注册用户 ({users.length})</h1>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">邮箱</th>
              <th className="text-left p-3">姓名</th>
              <th className="text-left p-3">角色</th>
              <th className="text-left p-3">状态</th>
              <th className="text-left p-3">关联企业</th>
              <th className="text-left p-3">注册时间</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">{u.status}</td>
                <td className="p-3">{u.supplier?.name || "-"}</td>
                <td className="p-3">{u.createdAt.toLocaleDateString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
