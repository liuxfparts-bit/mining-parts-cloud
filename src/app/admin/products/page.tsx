export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { approveProduct, rejectProduct, setProductStatus, toggleFeaturedProduct } from "../actions";
import Pagination from "@/components/Pagination";

export default async function AdminProductsPage({ searchParams }: { searchParams: { q?: string; status?: string; page?: string; pageSize?: string } }) {
  const q = (searchParams.q || "").trim();
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [20, 50, 100].includes(parseInt(searchParams.pageSize || "20")) ? parseInt(searchParams.pageSize || "20") : 20;
  const where: any = {};
  if (q) where.OR = [
    { name: { contains: q, mode: "insensitive" as const } },
    { partNumber: { number: { contains: q, mode: "insensitive" as const } } },
    { supplier: { name: { contains: q, mode: "insensitive" as const } } },
  ];
  if (searchParams.status) where.status = searchParams.status;

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, include: { partNumber: true, supplier: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filters = [{ k: "", label: "全部" }, { k: "PENDING", label: "待审核" }, { k: "PUBLISHED", label: "已发布" }, { k: "REJECTED", label: "已驳回" }, { k: "DRAFT", label: "草稿" }];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">产品管理</h1>
      </div>
      <form method="GET" className="bg-white rounded-lg border p-3 mb-4 flex gap-2 flex-wrap">
        <input name="q" defaultValue={q} placeholder="产品名 / 件号 / 供应商" className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">搜索</button>
        <a href="/admin/products" className="border px-4 py-2 rounded text-sm">重置</a>
      </form>
      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <a key={f.k} href={f.k ? `/admin/products?status=${f.k}` : "/admin/products"}
            className={`text-xs px-3 py-1 rounded ${(!searchParams.status && !f.k) || searchParams.status === f.k ? "bg-blue-600 text-white" : "bg-gray-100"}`}>
            {f.label}
          </a>
        ))}
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr><th className="text-left p-3">产品</th><th className="text-left p-3">件号</th><th className="text-left p-3">供应商</th><th className="text-left p-3">类型</th><th className="text-left p-3">价格</th><th className="text-left p-3">状态</th><th className="text-left p-3">验证</th><th className="text-left p-3">首页推荐</th><th className="text-left p-3">操作</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? <tr><td colSpan={9} className="p-6 text-center text-gray-500">暂无数据</td></tr> :
              items.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{p.name}</td>
                  <td className="p-3 font-mono">{p.partNumber.number}</td>
                  <td className="p-3">{p.supplier.name}</td>
                  <td className="p-3">{p.productType}</td>
                  <td className="p-3">{p.price ? `${p.currency} ${p.price}` : "-"}</td>
                  <td className="p-3">{p.status}</td>
                  <td className="p-3">{p.verificationStatus}</td>
                  <td className="p-3">
                    <form action={async () => { "use server"; await toggleFeaturedProduct(p.id); }}>
                      <button className={`text-xs px-2 py-1 rounded ${p.isFeatured ? "bg-yellow-100 text-yellow-700" : "bg-gray-100"}`}>
                        {p.isFeatured ? "★ 已推荐" : "设为推荐"}
                      </button>
                    </form>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {p.status === "PENDING" && (
                        <form action={async () => { "use server"; await approveProduct(p.id); }}>
                          <button className="text-xs px-2 py-1 bg-green-100 text-green-700">通过</button>
                        </form>
                      )}
                      {(p.status === "PENDING" || p.status === "REJECTED") && (
                        <form action={async (fd) => { "use server"; await rejectProduct(p.id, (fd.get("reason") as string) || "不符合"); }}>
                          <input name="reason" placeholder="驳回原因" className="text-xs border rounded px-1 py-1 w-24" />
                          <button className="text-xs px-2 py-1 bg-red-100 text-red-700 ml-1">驳回</button>
                        </form>
                      )}
                      {p.status === "PUBLISHED" && (
                        <form action={async () => { "use server"; await setProductStatus(p.id, "OFFLINE"); }}>
                          <button className="text-xs px-2 py-1 bg-gray-100">下架</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} baseQuery={new URLSearchParams(searchParams as any)} />
    </div>
  );
}
