export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Pagination from "@/components/Pagination";

export default async function BuyerProducts({ searchParams }: { searchParams: { page?: string; pageSize?: string } }) {
  const s = await auth();
  if (!s) redirect("/login");
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [20, 50, 100].includes(parseInt(searchParams.pageSize || "20")) ? parseInt(searchParams.pageSize || "20") : 20;
  const where = { status: { in: ["PUBLISHED", "ACTIVE"] } };
  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, include: { partNumber: true, supplier: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">市场产品</h1>
      <p className="text-sm text-gray-500 mb-4">您当前是采购商，可浏览以下已上架产品并发起询价。</p>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr><th className="p-3 text-left">产品</th><th className="p-3 text-left">件号</th><th className="p-3 text-left">供应商</th><th className="p-3 text-left">价格</th><th className="p-3 text-left">操作</th></tr></thead>
          <tbody>
            {products.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-gray-500">暂无产品</td></tr> :
              products.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="p-3">{p.name}</td>
                  <td className="p-3 font-mono">{p.partNumber?.number}</td>
                  <td className="p-3">{p.supplier?.name}</td>
                  <td className="p-3">{p.price ? `${p.currency} ${p.price}` : "-"}</td>
                  <td className="p-3"><Link href={`/part-number/${p.partNumber?.number}`} className="text-blue-600 text-xs">查看</Link></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} baseQuery={new URLSearchParams(searchParams as any)} />
    </div>
  );
}
