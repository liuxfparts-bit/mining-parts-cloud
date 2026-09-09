export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";

export default async function AdminVerificationPage() {
  const pending = await prisma.supplier.findMany({
    where: { verifiedStatus: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">寰呭鏍镐紒涓?/h1>
        <span className="text-sm text-gray-500">{pending.length} 瀹跺緟瀹℃牳</span>
      </div>
      {pending.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">鏆傛棤寰呭鏍镐紒涓?/div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">浼佷笟鍚嶇О</th>
                <th className="text-left p-3">鑱旂郴浜?/th>
                <th className="text-left p-3">鍦板尯</th>
                <th className="text-left p-3">涓昏惀</th>
                <th className="text-left p-3">鎻愪氦鏃堕棿</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((s) => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.contactName || "-"}</td>
                  <td className="p-3">{s.province || "-"}</td>
                  <td className="p-3 text-gray-600">{s.mainBusiness}</td>
                  <td className="p-3">{s.createdAt.toLocaleDateString("zh-CN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

