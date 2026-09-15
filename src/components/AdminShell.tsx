"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Building2, Tags, Wrench, Package, Hash,
  FileText, MessageSquare, Search, Crown, Megaphone, Menu, X,
} from "lucide-react";

const menuSections = [
  {
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "企业",
    items: [
      { href: "/admin/suppliers", label: "企业列表", icon: Building2 },
      { href: "/admin/verification", label: "待审核", icon: Building2 },
    ],
  },
  {
    title: "内容管理",
    items: [
      { href: "/admin/brands", label: "品牌", icon: Tags },
      { href: "/admin/equipment", label: "设备", icon: Wrench },
      { href: "/admin/products", label: "配件/产品", icon: Package },
      { href: "/admin/part-numbers", label: "件号", icon: Hash },
    ],
  },
  {
    title: "交易",
    items: [
      { href: "/admin/rfqs", label: "询价", icon: FileText },
      { href: "/admin/quotes", label: "报价记录", icon: MessageSquare },
    ],
  },
  {
    title: "运营",
    items: [
      { href: "/admin/seo", label: "SEO", icon: Search },
      { href: "/admin/members", label: "会员", icon: Crown },
      { href: "/admin/ads", label: "广告", icon: Megaphone },
      { href: "/admin/banners", label: "Banner / 推荐位", icon: Megaphone },
    ],
  },
];

export default function AdminShell({
  userName,
  children,
}: {
  userName?: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const sidebar = (
    <aside className="w-[220px] bg-dark text-white flex flex-col shrink-0 h-full">
      <div className="h-14 flex items-center px-5 font-black text-lg border-b border-white/10">
        矿配云<span className="text-accent ml-1">Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {menuSections.map((section, i) => (
          <div key={i} className="mb-4">
            {section.title && (
              <div className="px-5 text-xs text-white/40 uppercase tracking-wider mb-1">{section.title}</div>
            )}
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-5 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-2">
        <div className="text-xs text-white/60">👑 {userName}</div>
        <Link href="/" className="block text-xs text-white/40 hover:text-white">← 返回前台</Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-xs text-white/40 hover:text-white transition-colors"
        >
          退出登录
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#f5f6f8]">
      {/* 手机端遮罩 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 侧边栏：PC 常驻；手机为抽屉 */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:static lg:translate-x-0 lg:transform-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </div>

      {/* 主内容区 */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 手机端顶栏 */}
        <div className="lg:hidden sticky top-0 z-30 bg-dark text-white flex items-center justify-between px-4 h-12">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="p-1"
            aria-label="打开菜单"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold">矿配云 Admin</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 text-white/60"
            aria-label="关闭菜单"
          >
            <X size={18} />
          </button>
        </div>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
