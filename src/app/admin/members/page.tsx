export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { updateMemberLevel } from "../actions";

const MEMBER: Record<string, string> = {
  FREE: "普通会员",
  BRONZE: "铜牌会员",
  SILVER: "银牌会员",
  GOLD: "金牌会员",
};

export default async function AdminMembers() {
  const suppliers = await prisma.supplier.findMany({ orderBy: { memberLevel: "asc" } });

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">会员管理（{suppliers.length} 家企业）</h1>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">企业</th>
              <th className="text-left p-3">联系人</th>
              <th className="text-left p-3">当前等级</th>
              <th className="text-left p-3">认证状态</th>
              <th className="text-left p-3">修改等级</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3">{s.contactName || "-"}</td>
                <td className="p-3">{MEMBER[s.memberLevel] || s.memberLevel}</td>
                <td className="p-3">{s.verifiedStatus}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {["FREE", "BRONZE", "SILVER", "GOLD"].map((lv) => (
                      <form key={lv} action={async () => { "use server"; await updateMemberLevel(s.id, lv); }}>
                        <button className={`text-xs px-2 py-1 rounded ${s.memberLevel === lv ? "bg-blue-600 text-white" : "bg-gray-100"}`}>
                          {MEMBER[lv]}
                        </button>
                      </form>
                    ))}
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
