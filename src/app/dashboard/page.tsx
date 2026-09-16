export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  FileText,
  BadgeDollarSign,
  ShieldCheck,
  Users,
  FilePlus2,
  Send,
  ArrowRight,
  Building2,
  Clock,
} from "lucide-react";
import {
  getBuyerCompanyForUser,
  getCompanyUserIds,
  BUYER_VERIFY_STATUS_CN,
  BUYER_LEVEL_CN,
  BUYER_LEVEL_BADGE,
} from "@/lib/buyer-company";

const statusMap: Record<string, { label: string; cls: string }> = {
  COLLECTING: { label: "征集中", cls: "bg-blue-50 text-blue-700" },
  QUOTED: { label: "已报价", cls: "bg-green-50 text-green-700" },
  SELECTED: { label: "已选定", cls: "bg-green-50 text-green-700" },
  CLOSED: { label: "已关闭", cls: "bg-gray-100 text-gray-600" },
  EXPIRED: { label: "已过期", cls: "bg-red-50 text-red-600" },
  REJECTED: { label: "已驳回", cls: "bg-red-50 text-red-600" },
};

export default async function BuyerDashboard() {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, name: true, buyerCompanyId: true, isOwner: true },
  });
  if (!user) redirect("/login");

  const company = await getBuyerCompanyForUser(user.id);
  const companyUserIds = await getCompanyUserIds(user.id);
  const companyId = user.buyerCompanyId ?? -1;

  // 企业共享 RFQ 条件
  const rfqWhere: any = { OR: [{ userID: { in: companyUserIds } }, { companyID: companyId }] };

  // ===== 指标 =====
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [totalRfq, monthRfq, totalQuotes, pendingQuotes] = await Promise.all([
    prisma.rFQ.count({ where: rfqWhere }),
    prisma.rFQ.count({ where: { ...rfqWhere, createdAt: { gte: monthStart } } }),
    prisma.quote.count({ where: { rfq: { OR: [{ userID: { in: companyUserIds } }, { companyID: companyId }] } } }),
    prisma.quote.count({
      where: { rfq: { OR: [{ userID: { in: companyUserIds } }, { companyID: companyId }] }, status: "PENDING" },
    }),
  ]);

  // ===== 最新询价动态 =====
  const recentRfqs = await prisma.rFQ.findMany({
    where: rfqWhere,
    select: {
      id: true,
      rfqNo: true,
      title: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      _count: { select: { items: true, quotes: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  // ===== 未读系统消息 =====
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const verifyStatus = company?.verifiedStatus || "UNSUBMITTED";
  const isVerified = verifyStatus === "VERIFIED";
  const teamCount = company?.users.length || 1;

  const statCards = [
    {
      label: "我的询价",
      value: totalRfq,
      sub: `本月新增 ${monthRfq}`,
      href: "/dashboard/rfqs",
      icon: FileText,
      iconCls: "bg-blue-50 text-blue-600",
    },
    {
      label: "收到报价",
      value: totalQuotes,
      sub: `待处理 ${pendingQuotes}`,
      href: "/dashboard/quotes",
      icon: BadgeDollarSign,
      iconCls: "bg-green-50 text-green-600",
    },
    {
      label: "企业认证",
      value: BUYER_VERIFY_STATUS_CN[verifyStatus] || verifyStatus,
      sub: isVerified ? "已通过" : "未通过认证",
      href: "/dashboard/company",
      icon: ShieldCheck,
      iconCls: isVerified ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600",
    },
    {
      label: "会员等级",
      value: `${BUYER_LEVEL_CN[company?.level || "NORMAL"]}会员`,
      sub: `${company?.companyName || "未认证企业"} · ${teamCount} 人`,
      href: "/dashboard/team",
      icon: Users,
      iconCls: "bg-orange-50 text-orange-600",
    },
  ];

  return (
    <div className="space-y-5">
      {/* 欢迎语 */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800">欢迎回来，{user.name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {company?.companyName || "完善企业认证后可发布询价并邀请供应商报价"}
        </p>
      </div>

      {/* 指标卡片 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              href={c.href}
              className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 hover:shadow-md hover:border-slate-300 transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-500">{c.label}</div>
                  <div className="text-xl lg:text-2xl font-bold text-slate-800 mt-1 truncate">{c.value}</div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">{c.sub}</div>
                </div>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.iconCls}`}>
                  <Icon className="w-4.5 h-4.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Link
          href="/rfq/create"
          className="group bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 hover:border-blue-300 hover:shadow-md transition-all"
        >
          <span className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <FilePlus2 className="w-5 h-5" />
          </span>
          <div>
            <div className="font-semibold text-sm text-slate-800 group-hover:text-blue-700">发布新询价</div>
            <div className="text-xs text-slate-400">多件号 / Excel 批量导入</div>
          </div>
          <ArrowRight className="w-4 h-4 ml-auto text-slate-300 group-hover:text-blue-500" />
        </Link>
        <Link
          href="/dashboard/rfqs"
          className="group bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 hover:border-blue-300 hover:shadow-md transition-all"
        >
          <span className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </span>
          <div>
            <div className="font-semibold text-sm text-slate-800 group-hover:text-indigo-700">邀请供应商报价</div>
            <div className="text-xs text-slate-400">进入询价详情发起邀请</div>
          </div>
          <ArrowRight className="w-4 h-4 ml-auto text-slate-300 group-hover:text-indigo-500" />
        </Link>
        <Link
          href={user.isOwner ? "/dashboard/team" : "/dashboard/company"}
          className="group bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 hover:border-blue-300 hover:shadow-md transition-all col-span-2 lg:col-span-1"
        >
          <span className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <div className="font-semibold text-sm text-slate-800 group-hover:text-emerald-700">
              {user.isOwner ? "管理团队" : "企业认证"}
            </div>
            <div className="text-xs text-slate-400">{user.isOwner ? "添加采购员 / 分配权限" : "查看认证进度"}</div>
          </div>
          <ArrowRight className="w-4 h-4 ml-auto text-slate-300 group-hover:text-emerald-500" />
        </Link>
      </div>

      {/* 两列布局 */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* 左 65%：最新询价动态 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-sm text-slate-700">最新询价动态</h2>
            <Link href="/dashboard/rfqs" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              查看全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentRfqs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              暂无询价记录
              <div className="mt-2">
                <Link href="/rfq/create" className="text-blue-600 font-medium">
                  发布第一条询价 →
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2.5">询价单号</th>
                    <th className="text-left px-4 py-2.5">标题</th>
                    <th className="text-center px-4 py-2.5">项目</th>
                    <th className="text-center px-4 py-2.5">报价</th>
                    <th className="text-left px-4 py-2.5">状态</th>
                    <th className="text-left px-4 py-2.5">发布时间</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRfqs.map((r) => {
                    const st = statusMap[r.status] || { label: r.status, cls: "bg-gray-100 text-gray-600" };
                    return (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {r.rfqNo || `#${r.id}`}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-700 max-w-[200px] truncate">{r.title}</td>
                        <td className="px-4 py-2.5 text-center text-slate-500">{r._count.items} 项</td>
                        <td className="px-4 py-2.5 text-center text-slate-500">{r._count.quotes} 家</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block text-[11px] px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 右 35%：企业信息 + 系统消息 */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-sm text-slate-700">企业信息与认证</h2>
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm text-slate-800 truncate">{company?.companyName || "未认证"}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {company?.region || "地区未填写"} · 认证：{BUYER_VERIFY_STATUS_CN[verifyStatus]}
                </div>
              </div>
              <span
                className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${BUYER_LEVEL_BADGE[company?.level || "NORMAL"]}`}
              >
                {BUYER_LEVEL_CN[company?.level || "NORMAL"]}会员
              </span>
            </div>
            {!isVerified && (
              <Link
                href="/dashboard/company"
                className="block w-full text-center text-xs bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700"
              >
                {verifyStatus === "PENDING" ? "查看认证进度" : "立即企业认证"}
              </Link>
            )}
            {isVerified && (
              <div className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                企业认证已通过，可正常发布询价与邀请供应商
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-sm text-slate-700">系统消息</h2>
              <Link href="/dashboard/notifications" className="ml-auto text-xs text-blue-600 hover:underline">
                全部
              </Link>
            </div>
            {notifications.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center">暂无消息</div>
            ) : (
              <ul className="space-y-2.5">
                {notifications.map((n) => (
                  <li key={n.id} className="text-sm">
                    <div className="font-medium text-slate-700 text-[13px] truncate">{n.title}</div>
                    {n.content && <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.content}</div>}
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      {new Date(n.createdAt).toLocaleString("zh-CN")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
