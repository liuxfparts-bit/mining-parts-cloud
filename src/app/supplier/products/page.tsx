export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Pagination from "@/components/Pagination";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  DRAFT: { text: "草稿", cls: "bg-gray-100 text-gray-700" },
  PENDING: { text: "审核中", cls: "bg-yellow-100 text-yellow-700" },
  PUBLISHED: { text: "已上线", cls: "bg-green-100 text-green-700" },
  REJECTED: { text: "已驳回", cls: "bg-red-100 text-red-700" },
  OFFLINE: { text: "已下架", cls: "bg-gray-100 text-gray-700" },
};

const VERIFY_LABEL: Record<string, string> = {
  UNVERIFIED: "未验证",
  PENDING: "验证中",
  VERIFIED: "已验证",
  REJECTED: "未通过",
};

export default async function SupplierProducts({ searchParams }: { searchParams: { q?: string; status?: string; v?: string; page?: string; pageSize?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");

  const q = (searchParams.q || "").trim();
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [20, 50, 100].includes(parseInt(searchParams.pageSize || "20")) ? parseInt(searchParams.pageSize || "20") : 20;
  const where: any = { supplierId: user.supplierId };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" as const } }, { partNumber: { number: { contains: q, mode: "insensitive" as const } } }];
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.v) where.verificationStatus = searchParams.v;

  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, include: { partNumber: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">我的产品</h1>
        <Link href="/supplier/products/new" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">+ 新增产品</Link>
      </div>

      {/* Toolbar */}
      <form method="GET" className="bg-white border rounded-lg p-3 mb-4 flex gap-2 flex-wrap items-center">
        <input name="q" defaultValue={q} placeholder="产品名称 / 件号" className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]" />
        <select name="status" className="border rounded px-3 py-2 text-sm">
          <option value="">全部状态</option>
          <option value="PUBLISHED">已上线</option>
          <option value="PENDING">审核中</option>
          <option value="REJECTED">已驳回</option>
          <option value="OFFLINE">已下架</option>
          <option value="DRAFT">草稿</option>
        </select>
        <select name="v" className="border rounded px-3 py-2 text-sm">
          <option value="">全部验证</option>
          <option value="VERIFIED">已验证</option>
          <option value="UNVERIFIED">未验证</option>
          <option value="PENDING">验证中</option>
          <option value="REJECTED">未通过</option>
        </select>
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">筛选</button>
        <a href="/supplier/products" className="border px-4 py-2 rounded text-sm">重置</a>
      </form>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 w-10">图片</th>
              <th className="text-left p-3">产品</th>
              <th className="text-left p-3">件号</th>
              <th className="text-left p-3">价格</th>
              <th className="text-left p-3">发布状态</th>
              <th className="text-left p-3">验证状态</th>
              <th className="text-left p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-gray-500">暂无产品</td></tr> :
              products.map((p) => {
                const s = STATUS_LABEL[p.status] || { text: p.status, cls: "bg-gray-100" };
                const img = p.images ? p.images.split(",")[0] : null;
                return (
                  <tr key={p.id} className="border-b">
                    <td className="p-3">
                      {img ? <img src={img} className="h-12 w-12 object-cover rounded border" /> : <div className="h-12 w-12 rounded bg-gray-100 border flex items-center justify-center text-gray-400 text-xs">无图</div>}
                    </td>
                    <td className="p-3">
                      {p.name}
                      {p.status === "REJECTED" && p.verificationReason && (
                        <div className="text-xs text-red-600 mt-1">驳回原因：{p.verificationReason}</div>
                      )}
                    </td>
                    <td className="p-3 font-mono">{p.partNumber?.number || "-"}</td>
                    <td className="p-3">{p.price ? `${p.currency} ${p.price}` : "-"}</td>
                    <td className="p-3"><span className={`text-xs px-2 py-1 rounded ${s.cls}`}>{s.text}</span></td>
                    <td className="p-3 text-xs">{VERIFY_LABEL[p.verificationStatus] || p.verificationStatus}</td>
                    <td className="p-3"><Link href={`/supplier/products/${p.id}/edit`} className="text-blue-600">编辑</Link></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} baseQuery={new URLSearchParams(searchParams as any)} />
    </div>
  );
}
