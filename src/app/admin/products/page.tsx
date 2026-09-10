export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { approveProduct, rejectProduct, setProductStatus } from "../actions";

export default async function AdminProductsPage({ searchParams }: { searchParams: { status?: string } }) {
  const filter = searchParams.status;
  const where = filter ? { status: filter } : {};
  const items = await prisma.product.findMany({
    where,
    include: { partNumber: true, supplier: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const filters = [
    { k: "", label: "全部" },
    { k: "PENDING", label: "待审核" },
    { k: "PUBLISHED", label: "已发布" },
    { k: "REJECTED", label: "已驳回" },
    { k: "DRAFT", label: "草稿" },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">产品管理</h1>
        <span className="text-sm text-gray-500">共 {items.length} 个</span>
      </div>
      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <a key={f.k} href={f.k ? `/admin/products?status=${f.k}` : "/admin/products"}
            className={`text-xs px-3 py-1 rounded ${(!filter && !f.k) || filter === f.k ? "bg-blue-600 text-white" : "bg-gray-100"}`}>
            {f.label}
          </a>
        ))}
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">产品</th>
              <th className="text-left p-3">件号</th>
              <th className="text-left p-3">供应商</th>
              <th className="text-left p-3">类型</th>
              <th className="text-left p-3">价格</th>
              <th className="text-left p-3">发布状态</th>
              <th className="text-left p-3">验证状态</th>
              <th className="text-left p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{p.name}</td>
                <td className="p-3 font-mono">{p.partNumber.number}</td>
                <td className="p-3">{p.supplier.name}</td>
                <td className="p-3">{p.productType}</td>
                <td className="p-3">{p.price ? `${p.currency} ${p.price}` : "-"}</td>
                <td className="p-3">{p.status}</td>
                <td className="p-3">{p.verificationStatus}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {p.status === "PENDING" && (
                      <form action={async () => { "use server"; await approveProduct(p.id); }}>
                        <button className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">通过</button>
                      </form>
                    )}
                    {(p.status === "PENDING" || p.status === "REJECTED") && (
                      <form action={async (fd) => {
                        "use server";
                        const reason = (fd.get("reason") as string) || "不符合要求";
                        await rejectProduct(p.id, reason);
                      }}>
                        <input name="reason" placeholder="驳回原因" className="text-xs border rounded px-1 py-1 w-24" />
                        <button className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 ml-1">驳回</button>
                      </form>
                    )}
                    {p.status === "PUBLISHED" && (
                      <form action={async () => { "use server"; await setProductStatus(p.id, "OFFLINE"); }}>
                        <button className="text-xs px-2 py-1 rounded bg-gray-100">下架</button>
                      </form>
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
