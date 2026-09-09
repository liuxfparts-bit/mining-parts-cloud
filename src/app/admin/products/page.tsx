export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { setProductStatus } from "../actions";

export default async function AdminProductsPage() {
  const items = await prisma.product.findMany({
    include: { partNumber: true, supplier: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">产品管理</h1>
        <span className="text-sm text-gray-500">共 {items.length} 个</span>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">产品</th>
              <th className="text-left p-3">件号</th>
              <th className="text-left p-3">供应商</th>
              <th className="text-left p-3">类型</th>
              <th className="text-left p-3">价格</th>
              <th className="text-left p-3">状态</th>
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
                <td className="p-3">
                  <form action={async () => {
                    "use server";
                    await setProductStatus(p.id, p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
                  }}>
                    <button className={`text-xs px-2 py-1 rounded ${p.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100"}`}>
                      {p.status === "ACTIVE" ? "上架中" : "已下架"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
