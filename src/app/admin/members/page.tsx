import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const levelMap: Record<string, { label: string; badge: string }> = {
  FREE: { label: "免费", badge: "bg-gray-100" },
  BRONZE: { label: "铜牌", badge: "bg-orange-50 text-orange-700" },
  SILVER: { label: "银牌", badge: "bg-gray-100 text-gray-700" },
  GOLD: { label: "金牌", badge: "bg-yellow-50 text-yellow-700" },
};

export default async function AdminMembers() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ memberLevel: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">会员管理</h1>
      <div className="bg-white border border-line rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f8f9] border-b border-line">
            <tr>
              <th className="text-left p-3 font-bold">企业</th>
              <th className="text-left p-3 font-bold">地区</th>
              <th className="text-left p-3 font-bold">会员等级</th>
              <th className="text-left p-3 font-bold">认证</th>
              <th className="text-right p-3 font-bold">产品数</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => {
              const lv = levelMap[s.memberLevel] || levelMap.FREE;
              return (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="p-3 font-bold">{s.shortName || s.name}</td>
                  <td className="p-3 text-muted">{s.province || "-"}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded ${lv.badge}`}>{lv.label}</span>
                  </td>
                  <td className="p-3">
                    {s.verifiedStatus === "VERIFIED" ? "✓ 已认证" : s.verifiedStatus === "PENDING" ? "待审核" : "未认证"}
                  </td>
                  <td className="p-3 text-right">{s.productCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
