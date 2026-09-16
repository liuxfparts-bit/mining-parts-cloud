export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const statusMap: Record<string, { label: string; cls: string }> = {
  COLLECTING: { label: "征集中", cls: "bg-blue-50 text-blue-700" },
  QUOTED: { label: "已报价", cls: "bg-green-50 text-green-700" },
  SELECTED: { label: "已选定", cls: "bg-green-50 text-green-700" },
  CLOSED: { label: "已关闭", cls: "bg-gray-100 text-gray-600" },
  EXPIRED: { label: "已过期", cls: "bg-red-50 text-red-600" },
  REJECTED: { label: "已驳回", cls: "bg-red-50 text-red-600" },
};

export default async function BuyerRfqs() {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: String((s.user as any).email).toLowerCase() } });
  if (!user) redirect("/login");

  // 服务端归属查询：只返回当前登录用户发布的 RFQ（以 session 为准，不信任任何前端参数）
  const rfqs = await prisma.rFQ.findMany({
    where: { userID: user.id },
    include: {
      items: { orderBy: { seq: "asc" } },
      quotes: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-bold">我的询价（{rfqs.length}）</h1>
        <Link href="/rfq/create" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">
          发布询价（多件号 / Excel 导入）
        </Link>
      </div>

      {rfqs.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">
          <p className="mb-3">您还没有发布过询价</p>
          <Link href="/rfq/create" className="text-blue-600 text-sm font-medium">
            立即发布第一条采购询价 →
          </Link>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 text-left">询价编号 / 标题</th>
                  <th className="p-3 text-left">明细数</th>
                  <th className="p-3 text-left">报价</th>
                  <th className="p-3 text-left">状态</th>
                  <th className="p-3 text-left">发布时间</th>
                  <th className="p-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((r) => {
                  const st = statusMap[r.status] || { label: r.status, cls: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        {r.rfqNo && <div className="text-xs font-mono text-gray-400">{r.rfqNo}</div>}
                        <div className="font-medium">{r.title}</div>
                      </td>
                      <td className="p-3">{r.items.length} 项</td>
                      <td className="p-3">{r.quotes.length} 家</td>
                      <td className="p-3">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="p-3 text-gray-500">{new Date(r.createdAt).toLocaleDateString("zh-CN")}</td>
                      <td className="p-3">
                        <Link
                          href={`/dashboard/rfqs/${r.id}`}
                          className="text-blue-600 hover:underline text-sm whitespace-nowrap">
                          查看详情 / 管理
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
