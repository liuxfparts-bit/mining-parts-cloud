import { prisma } from "@/lib/prisma";

export default async function AdminVerificationPage() {
  const pending = await prisma.supplier.findMany({
    where: { verifiedStatus: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">待审核企业</h1>
        <span className="text-sm text-gray-500">{pending.length} 家待审核</span>
      </div>
      {pending.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">暂无待审核企业</div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">企业名称</th>
                <th className="text-left p-3">联系人</th>
                <th className="text-left p-3">地区</th>
                <th className="text-left p-3">主营</th>
                <th className="text-left p-3">提交时间</th>
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
