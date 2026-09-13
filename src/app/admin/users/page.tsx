export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import ResetPwButton from "./ResetPwButton";

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: { q?: string; role?: string; status?: string; page?: string; pageSize?: string };
}) {
  const q = (searchParams.q || "").trim();
  const role = searchParams.role || "";
  const status = searchParams.status || "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = [20, 50, 100].includes(Number(searchParams.pageSize)) ? Number(searchParams.pageSize) : 20;

  const where: any = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { supplier: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (role) where.role = role;
  if (status) where.status = status;

  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const users = await prisma.user.findMany({
    where,
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const qs = (params: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (role) sp.set("role", role);
    if (status) sp.set("status", status);
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") sp.set(k, String(v)); });
    return sp.toString();
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">用户管理（共 {total}）</h1>

      <form className="bg-white border rounded p-3 mb-4 flex flex-wrap gap-2 items-center">
        <input name="q" defaultValue={q} placeholder="邮箱/姓名/手机/公司"
          className="border rounded px-3 py-1.5 text-sm w-64" />
        <select name="role" defaultValue={role} className="border rounded px-3 py-1.5 text-sm">
          <option value="">全部角色</option>
          <option value="ADMIN">ADMIN</option>
          <option value="SUPPLIER">SUPPLIER</option>
          <option value="BUYER">BUYER</option>
        </select>
        <select name="status" defaultValue={status} className="border rounded px-3 py-1.5 text-sm">
          <option value="">全部状态</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="DISABLED">DISABLED</option>
        </select>
        <select name="pageSize" defaultValue={String(pageSize)} className="border rounded px-3 py-1.5 text-sm">
          <option value="20">20/页</option>
          <option value="50">50/页</option>
          <option value="100">100/页</option>
        </select>
        <button className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm">搜索</button>
      </form>

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
              <th className="text-left p-3">操作</th>
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
                <td className="p-3">
                  <ResetPwButton userId={u.id} userEmail={u.email} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <div>第 {page} / {totalPages} 页</div>
        <div className="flex gap-2">
          {page > 1 && <a href={`/admin/users?${qs({ page: page - 1 })}`} className="px-3 py-1 border rounded">上一页</a>}
          {page < totalPages && <a href={`/admin/users?${qs({ page: page + 1 })}`} className="px-3 py-1 border rounded">下一页</a>}
        </div>
      </div>
    </div>
  );
}
