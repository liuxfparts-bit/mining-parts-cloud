export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";

export default async function AdminProductsPage() {
  const items = await prisma.product.findMany({
    include: { partNumber: true, supplier: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">浜у搧绠＄悊</h1>
        <span className="text-sm text-gray-500">鍏?{items.length} 涓?/span>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">浜у搧鍚嶇О</th>
              <th className="text-left p-3">浠跺彿</th>
              <th className="text-left p-3">渚涘簲鍟?/th>
              <th className="text-left p-3">绫诲瀷</th>
              <th className="text-left p-3">浠锋牸</th>
              <th className="text-left p-3">鐘舵€?/th>
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
                <td className="p-3"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

