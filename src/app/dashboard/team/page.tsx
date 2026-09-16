export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBuyerCompanyForUser } from "@/lib/buyer-company";
import { toggleMemberStatus, resetMemberPassword } from "./actions";
import AddMemberForm from "./AddMemberForm";
import { Users, KeyRound, Ban, CheckCircle2 } from "lucide-react";

export default async function BuyerTeamPage() {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, role: true, isOwner: true },
  });
  if (!user || user.role !== "BUYER") redirect("/dashboard");
  // 仅主账号可见团队管理
  if (!user.isOwner) redirect("/dashboard");

  const company = await getBuyerCompanyForUser(user.id);
  if (!company) redirect("/dashboard/company");

  const members = company.users.sort((a, b) => (a.isOwner ? -1 : 1) - (b.isOwner ? -1 : 1));

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">团队 / 采购员管理</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {company.companyName} · 共 {members.length} 名采购员，所有成员共享企业认证状态与询价数据
        </p>
      </div>

      {/* 成员列表 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <Users className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-sm text-slate-700">企业成员（{members.length}）</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5">成员</th>
                <th className="text-left px-4 py-2.5">手机号</th>
                <th className="text-left px-4 py-2.5">岗位</th>
                <th className="text-left px-4 py-2.5">角色</th>
                <th className="text-left px-4 py-2.5">状态</th>
                <th className="text-left px-4 py-2.5">操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{m.name}</div>
                    <div className="text-xs text-slate-400">{m.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{m.phone || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{m.position || "采购员"}</td>
                  <td className="px-4 py-3">
                    {m.isOwner ? (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        主账号
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-500">子账号</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-green-50 text-green-700">
                        <CheckCircle2 className="w-3 h-3" /> 已启用
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-600">
                        <Ban className="w-3 h-3" /> 已禁用
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.isOwner ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <form action={toggleMemberStatus}>
                          <input type="hidden" name="memberId" value={m.id} />
                          <button
                            className={`text-xs px-2 py-1 rounded border ${
                              m.status === "ACTIVE"
                                ? "text-red-600 border-red-200 hover:bg-red-50"
                                : "text-green-600 border-green-200 hover:bg-green-50"
                            }`}
                          >
                            {m.status === "ACTIVE" ? "禁用" : "启用"}
                          </button>
                        </form>
                        <ResetPasswordForm memberId={m.id} name={m.name} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 添加采购员 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-sm text-slate-700">添加采购员（子账号）</h2>
        </div>
        <AddMemberForm />
      </div>
    </div>
  );
}

// 重置密码（内联表单，避免额外客户端组件）
function ResetPasswordForm({ memberId, name }: { memberId: number; name: string }) {
  return (
    <form action={resetMemberPassword} className="inline-flex items-center gap-1">
      <input type="hidden" name="memberId" value={memberId} />
      <input
        name="newPassword"
        placeholder={`重置 ${name} 密码`}
        required
        minLength={6}
        className="w-32 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none"
      />
      <button className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 inline-flex items-center gap-1">
        <KeyRound className="w-3 h-3" /> 重置
      </button>
    </form>
  );
}
