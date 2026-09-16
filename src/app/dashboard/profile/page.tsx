export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBuyerCompanyForUser, BUYER_VERIFY_STATUS_CN, BUYER_LEVEL_CN } from "@/lib/buyer-company";
import { UserCircle } from "lucide-react";

export default async function BuyerProfilePage() {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, name: true, email: true, phone: true, position: true, isOwner: true, createdAt: true },
  });
  if (!user) redirect("/login");
  const company = await getBuyerCompanyForUser(user.id);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">个人资料</h1>
        <p className="text-sm text-slate-500 mt-0.5">查看当前登录账号的基本信息</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold">
            {(user.name || "用").trim()[0]}
          </span>
          <div>
            <div className="font-semibold text-slate-800">{user.name}</div>
            <div className="text-xs text-slate-400">{user.email}</div>
          </div>
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ["账号角色", "采购商"],
            ["账号类型", user.isOwner ? "主账号（企业负责人）" : "子账号（采购员）"],
            ["岗位角色", user.position || "采购员"],
            ["手机号", user.phone || "未填写"],
            ["所属企业", company?.companyName || "未认证"],
            ["企业认证", company ? BUYER_VERIFY_STATUS_CN[company.verifiedStatus] : "未提交"],
            ["企业等级", company ? `${BUYER_LEVEL_CN[company.level]}会员` : "-"],
            ["注册时间", new Date(user.createdAt).toLocaleDateString("zh-CN")],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-slate-50 pb-2">
              <dt className="text-slate-500 shrink-0">{k}</dt>
              <dd className="text-slate-800 text-right break-all">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex gap-3">
          <Link href="/account/security" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
            修改密码 →
          </Link>
          <Link href="/dashboard/company" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
            企业资料与认证 →
          </Link>
        </div>
      </div>
    </div>
  );
}
