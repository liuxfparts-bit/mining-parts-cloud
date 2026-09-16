"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  Send,
  BadgeDollarSign,
  Handshake,
  Building2,
  Users,
  UserCircle,
  KeyRound,
  Bell,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Clock,
  CircleX,
  Award,
} from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { BUYER_VERIFY_STATUS_CN, BUYER_LEVEL_CN, BUYER_LEVEL_BADGE } from "@/lib/buyer-company";

interface ShellCompany {
  companyName: string;
  verifiedStatus: string;
  rejectionReason: string | null;
  level: string;
}

const NAV_GROUPS: { group: string; items: { href: string; label: string; icon: any; show?: (c: any) => boolean }[] }[] = [
  {
    group: "控制台",
    items: [{ href: "/dashboard", label: "概览", icon: LayoutDashboard }],
  },
  {
    group: "询价管理",
    items: [
      { href: "/rfq/create", label: "发布询价", icon: FilePlus2 },
      { href: "/dashboard/rfqs", label: "我的询价", icon: FileText },
    ],
  },
  {
    group: "报价与供应商",
    items: [
      { href: "/dashboard/rfq-invitations", label: "询价邀请", icon: Send },
      { href: "/dashboard/quotes", label: "收到的报价", icon: BadgeDollarSign },
      { href: "/dashboard/suppliers", label: "合作供应商", icon: Handshake },
    ],
  },
  {
    group: "企业管理",
    items: [
      { href: "/dashboard/company", label: "企业资料与认证", icon: Building2 },
      { href: "/dashboard/team", label: "团队 / 采购员管理", icon: Users, show: (c) => c?.isOwner },
    ],
  },
  {
    group: "账号设置",
    items: [
      { href: "/dashboard/profile", label: "个人资料", icon: UserCircle },
      { href: "/account/security", label: "密码修改", icon: KeyRound },
    ],
  },
];

export default function DashboardShell({
  user,
  company,
  unreadCount,
  children,
}: {
  user: { name: string; email: string; role: string; isOwner: boolean; position: string | null };
  company: ShellCompany | null;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const status = company?.verifiedStatus || "UNSUBMITTED";
  const isVerified = status === "VERIFIED";
  const level = company?.level || "NORMAL";

  const verifyBanner =
    status === "VERIFIED" ? null : (
      <div
        className={`px-4 py-2.5 text-sm flex flex-wrap items-center gap-2 border-b ${
          status === "PENDING"
            ? "bg-amber-50 border-amber-200 text-amber-800"
            : status === "REJECTED"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-blue-50 border-blue-200 text-blue-800"
        }`}
      >
        {status === "PENDING" ? (
          <Clock className="w-4 h-4 shrink-0" />
        ) : status === "REJECTED" ? (
          <CircleX className="w-4 h-4 shrink-0" />
        ) : (
          <ShieldCheck className="w-4 h-4 shrink-0" />
        )}
        <span className="font-medium">
          {status === "PENDING"
            ? "企业认证审核中：审核通过后可发布 RFQ 及邀请供应商"
            : status === "REJECTED"
              ? `企业认证未通过${company?.rejectionReason ? `：${company.rejectionReason}` : "，请修改后重新提交"}`
              : "完善企业资质并通过认证，认证通过后方可发布 RFQ 及邀请供应商"}
        </span>
        <Link
          href="/dashboard/company"
          className="ml-auto shrink-0 bg-white border border-current rounded px-2.5 py-1 text-xs font-medium hover:opacity-80"
        >
          前往认证 {status === "PENDING" ? "查看进度" : "提交资料"} →
        </Link>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ===== 顶栏 ===== */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            type="button"
            className="lg:hidden p-1.5 rounded hover:bg-slate-100"
            onClick={() => setMobileOpen(true)}
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
              {(company?.companyName || user.name || "矿").trim()[0]}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate max-w-[160px] sm:max-w-[260px]">
                {company?.companyName || user.name}
              </div>
              {company && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-px rounded ${
                    isVerified
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Award className="w-2.5 h-2.5" />
                  {BUYER_VERIFY_STATUS_CN[status]} · {BUYER_LEVEL_CN[level]}
                </span>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {/* 消息通知 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded hover:bg-slate-100 cursor-pointer list-none"
                aria-label="消息通知"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg py-2 text-sm z-50">
                  <div className="px-4 py-1.5 font-semibold text-slate-700 border-b border-slate-100">消息通知</div>
                  <Link
                    href="/dashboard/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="block px-4 py-2 hover:bg-slate-50 text-blue-600 text-xs"
                  >
                    {unreadCount > 0 ? `查看全部（${unreadCount} 条未读）` : "查看全部"}
                  </Link>
                </div>
              )}
            </div>
            <UserMenu name={user.name} role={user.role} />
          </div>
        </div>
      </header>

      {verifyBanner}

      <div className="flex">
        {/* ===== 桌面侧边栏 ===== */}
        <aside className="hidden lg:block w-60 shrink-0 border-r border-slate-200/80 bg-white min-h-[calc(100vh-56px)]">
          <nav className="p-3 space-y-5 sticky top-14">
            {NAV_GROUPS.map((g) => {
              const items = g.items.filter((it) => !it.show || it.show({ isOwner: user.isOwner }));
              if (items.length === 0) return null;
              return (
                <div key={g.group}>
                  <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 tracking-wider">{g.group}</div>
                  <div className="space-y-0.5">
                    {items.map((it) => {
                      const active = pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href));
                      const Icon = it.icon;
                      return (
                        <Link
                          key={it.label}
                          href={it.href}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm ${
                            active
                              ? "bg-blue-50 text-blue-700 font-medium"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          {it.label}
                          {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* ===== 移动端抽屉 ===== */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100">
                <span className="font-semibold text-sm">{company?.companyName || "采购商工作台"}</span>
                <button type="button" onClick={() => setMobileOpen(false)} className="p-1.5 rounded hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-5">
                {NAV_GROUPS.map((g) => {
                  const items = g.items.filter((it) => !it.show || it.show({ isOwner: user.isOwner }));
                  if (items.length === 0) return null;
                  return (
                    <div key={g.group}>
                      <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 tracking-wider">{g.group}</div>
                      <div className="space-y-0.5">
                        {items.map((it) => {
                          const active = pathname === it.href;
                          const Icon = it.icon;
                          return (
                            <Link
                              key={it.label}
                              href={it.href}
                              onClick={() => setMobileOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm ${
                                active ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <Icon className="w-4 h-4 shrink-0" />
                              {it.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-slate-100 text-xs text-slate-400">
                {user.name} · {user.position || "采购员"}
              </div>
            </div>
          </div>
        )}

        {/* ===== 内容区 ===== */}
        <main className="flex-1 min-w-0">
          <div className="p-4 lg:p-6 max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
