export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";

export default async function AdminSuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    include: { _count: { select: { products: true } }, users: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">浼佷笟绠＄悊</h1>
        <span className="text-sm text-gray-500">鍏?{suppliers.length} 瀹朵紒涓?/span>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">ID</th>
              <th className="text-left p-3 font-medium">浼佷笟鍚嶇О</th>
              <th className="text-left p-3 font-medium">鍦板尯</th>
              <th className="text-left p-3 font-medium">涓昏惀鍝佺墝</th>
              <th className="text-left p-3 font-medium">浜у搧鏁?/th>
              <th className="text-left p-3 font-medium">璁よ瘉鐘舵€?/th>
              <th className="text-left p-3 font-medium">浼氬憳绛夌骇</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{s.id}</td>
                <td className="p-3 font-medium">
                  <a href={`/suppliers/${s.slug}`} className="text-blue-600 hover:underline">{s.name}</a>
                </td>
                <td className="p-3">{s.province || "-"}</td>
                <td className="p-3 text-gray-600">{s.mainBrands || "-"}</td>
                <td className="p-3">{s._count.products}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${s.verifiedStatus === "VERIFIED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {s.verifiedStatus}
                  </span>
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{s.memberLevel}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

