export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  DRAFT: { text: "草稿", cls: "bg-gray-100 text-gray-700" },
  PENDING: { text: "审核中", cls: "bg-yellow-100 text-yellow-700" },
  PUBLISHED: { text: "已发布", cls: "bg-green-100 text-green-700" },
  REJECTED: { text: "已驳回", cls: "bg-red-100 text-red-700" },
  OFFLINE: { text: "已下架", cls: "bg-gray-100 text-gray-700" },
};

export default async function SupplierProducts({ searchParams }: { searchParams: { page?: string; pageSize?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");

  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [20, 50, 100].includes(parseInt(searchParams.pageSize || "20")) ? parseInt(searchParams.pageSize || "20") : 20;
  const where = { supplierId: user.supplierId };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where, include: { partNumber: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">我的产品</h1>
        <Link href="/supplier/products/new" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">新增产品</Link>
      </div>
      {products.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">暂无产品</div>
      ) : (
        <>
          <table className="w-full bg-white border rounded-lg text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">图片</th><th className="text-left p-3">产品</th><th className="text-left p-3">件号</th>
                <th className="text-left p-3">价格</th><th className="text-left p-3">发布状态</th><th className="text-left p-3">验证</th><th className="text-left p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const s = STATUS_LABEL[p.status] || { text: p.status, cls: "" };
                return (
                  <tr key={p.id} className="border-b">
                    <td className="p-3">{p.images ? <img src={p.images.split(",")[0]} className="h-12 rounded border" /> : <span className="text-gray-400">-</span>}</td>
                    <td className="p-3">
                      {p.name}
                      {p.status === "REJECTED" && p.verificationReason && (
                        <div className="text-xs text-red-600 mt-1">驳回原因：{p.verificationReason}</div>
                      )}
                    </td>
                    <td className="p-3 font-mono">{p.partNumber?.number || "-"}</td>
                    <td className="p-3">{p.price ? `${p.currency} ${p.price}` : "-"}</td>
                    <td className="p-3"><span className={`text-xs px-2 py-1 rounded ${s.cls}`}>{s.text}</span></td>
                    <td className="p-3 text-xs">{p.verificationStatus}</td>
                    <td className="p-3"><Link href={`/supplier/products/${p.id}/edit`} className="text-blue-600">编辑</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-3 text-sm">
            <span>第 {page} / {totalPages} 页，共 {total} 条</span>
            <div className="flex gap-2">
              <Link href={`?page=${Math.max(1, page - 1)}&pageSize=${pageSize}`} className="border px-3 py-1 rounded">上一页</Link>
              <Link href={`?page=${Math.min(totalPages, page + 1)}&pageSize=${pageSize}`} className="border px-3 py-1 rounded">下一页</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
