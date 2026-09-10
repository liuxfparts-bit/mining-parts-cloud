export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function BuyerProducts() {
  const s = await auth();
  if (!s) redirect("/login");
  // 采购商不持有供应商产品，展示"浏览市场产品"入口
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: { partNumber: true, supplier: true },
    take: 20,
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">市场产品</h1>
      <p className="text-sm text-gray-500 mb-4">您当前是采购商，可浏览以下已上架产品并发起询价。</p>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr><th className="p-3 text-left">产品</th><th className="p-3 text-left">件号</th><th className="p-3 text-left">供应商</th><th className="p-3 text-left">价格</th><th className="p-3 text-left">操作</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-3">{p.name}</td>
                <td className="p-3 font-mono">{p.partNumber?.number}</td>
                <td className="p-3">{p.supplier?.name}</td>
                <td className="p-3">{p.price ? `$${p.price}` : "-"}</td>
                <td className="p-3"><Link href={`/part-number/${p.partNumber?.number}`} className="text-blue-600 text-xs">查看</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
