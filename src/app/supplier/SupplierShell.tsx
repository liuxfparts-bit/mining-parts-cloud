"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileSearch,
  Send,
  BadgeCheck,
  Package,
  PackagePlus,
  FileDigit,
  Building2,
  KeyRound,
  Bell,
  Menu,
  X,
  ChevronRight,
  Award,
  ShieldCheck,
  Plus,
} from "lucide-react";
import UserMenu from "@/components/UserMenu";

export interface ShellSupplier {
  name: string;
  shortName: string | null;
  memberLevel: string;
  verifiedStatus: string;
}

const MEMBER_CN: Record<string, string> = { FREE: "免费会员", BRONZE: "铜牌会员", SILVER: "银牌会员", GOLD: "金牌会员" };
const MEMBER_BADGE: Record<string, string> = {
  FREE: "bg-slate-100 text-slate-600",
  BRONZE: "bg-orange-50 text-orange-700 border border-orange-200",
  SILVER: "bg-slate-100 text-slate-600 border border-slate-300",
  GOLD: "bg-yellow-50 text-yellow-700 border border-yellow-300",
};

const NAV_GROUPS: { group: string; items: { href: string; label: string; icon: any }[] }[] = [
  {
    group: "工作台概览",
    items: [{ href: "/supplier", label: "工作台 / 控制台", icon: LayoutDashboard }],
  },
  {
    group: "报价与询价",
    items: [
      { href: "/supplier/rfqs", label: "待处理询价", icon: FileSearch },
      { href: "/supplier/invitations", label: "询价邀请", icon: Send },
      { href: "/supplier/quotes", label: "已投报价", icon: BadgeCheck },
    ],
  },
  {
    group: "产品与件号",
    items: [
      { href: "/supplier/products", label: "产品管理", icon: Package },
      { href: "/supplier/products/new", label: "发布新产品", icon: PackagePlus },
      { href: "/supplier/part-number-requests", label: "件号申请记录", icon: FileDigit },
    ],
  },
  {
    group: "企业与设置",
    items: [
      { href: "/supplier/profile", label: "企业资料与认证", icon: Building2 },
      { href: "/account/security", label: "账号管理", icon: KeyRound },
    ],
  },
];

export default function SupplierShell({
  user,
  supplier,
  unreadCount,
  children,
}: {
  user: { name: string; email: string };
  supplier: ShellSupplier | null;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const level = supplier?.memberLevel || "FREE";
  const isVerified = supplier?.verifiedStatus === "VERIFIED";
  const title = supplier?.shortName || supplier?.name || user.name;

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
              {(title || "供").trim()[0]}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate max-w-[160px] sm:max-w-[280px]">
                {supplier?.name || user.name}
              </div>
              {supplier && (
                <span className="inline-flex items-center gap-1 flex-wrap">
                  <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-px rounded ${MEMBER_BADGE[level]}`}>
                    <Award className="w-2.5 h-2.5" />
                    {MEMBER_CN[level] || level}
                  </span>
                  {isVerified && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-px rounded bg-green-50 text-green-700 border border-green-200">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      已认证
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* 快捷发布新产品 */}
            <Link
              href="/supplier/products/new"
              className="hidden sm:inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" /> 发布新产品
            </Link>

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
                  <div className="px-4 py-2 text-xs text-slate-400">
                    {unreadCount > 0 ? `${unreadCount} 条未读消息` : "暂无未读消息"}
                  </div>
                </div>
              )}
            </div>
            <UserMenu name={user.name} role="SUPPLIER" />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* ===== 桌面侧边栏 ===== */}
        <aside className="hidden lg:block w-60 shrink-0 border-r border-slate-200/80 bg-white min-h-[calc(100vh-56px)]">
          <nav className="p-3 space-y-5 sticky top-14">
            {NAV_GROUPS.map((g) => (
              <div key={g.group}>
                <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 tracking-wider">{g.group}</div>
                <div className="space-y-0.5">
                  {g.items.map((it) => {
                    const active = pathname === it.href || (it.href !== "/supplier" && pathname.startsWith(it.href));
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
            ))}
          </nav>
        </aside>

        {/* ===== 移动端抽屉 ===== */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100">
                <span className="font-semibold text-sm">{supplier?.name || "供应商工作台"}</span>
                <button type="button" onClick={() => setMobileOpen(false)} className="p-1.5 rounded hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-5">
                {NAV_GROUPS.map((g) => (
                  <div key={g.group}>
                    <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 tracking-wider">{g.group}</div>
                    <div className="space-y-0.5">
                      {g.items.map((it) => {
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
                ))}
              </nav>
              <div className="p-4 border-t border-slate-100 text-xs text-slate-400">
                {user.name} · {supplier?.shortName || "供应商"}
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
