export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function MyRequests({ searchParams }: { searchParams: { err?: string } }) {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");
  const list = await prisma.partNumberRequest.findMany({ where: { supplierId: user.supplierId }, include: { category: true }, orderBy: { createdAt: "desc" } });
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">我的件号申请</h1>
        <Link href="/supplier/part-number-requests/new" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">新增申请</Link>
      </div>
      {searchParams.err === "exists" && <div className="bg-red-50 text-red-700 p-3 rounded mb-3 text-sm">该件号已存在，请直接选择已有件号发布产品。</div>}
      {searchParams.err === "pending" && <div className="bg-yellow-50 text-yellow-700 p-3 rounded mb-3 text-sm">该件号正在审核中，请勿重复提交。</div>}
      {list.length === 0 ? <div className="bg-white border rounded-lg p-12 text-center text-gray-500">暂无申请</div> : (
        <table className="w-full bg-white border rounded-lg text-sm">
          <thead className="bg-gray-50"><tr><th className="p-2 text-left">件号</th><th className="p-2 text-left">名称</th><th className="p-2 text-left">分类</th><th className="p-2 text-left">状态</th><th className="p-2 text-left">时间</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2 font-mono">{r.partNumber}</td>
                <td className="p-2">{r.partName}</td>
                <td className="p-2">{r.category?.name || "-"}</td>
                <td className="p-2">{r.status}{r.status === "REJECTED" && r.reviewReason && <span className="text-red-600 block text-xs">{r.reviewReason}</span>}</td>
                <td className="p-2">{r.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
