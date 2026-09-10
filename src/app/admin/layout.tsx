import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import {
  LayoutDashboard, Building2, Tags, Wrench, Package, Hash,
  FileText, MessageSquare, Search, Crown, Megaphone,
} from "lucide-react";

const menuSections = [
  {
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-[#f5f6f8]">
      {/* 侧边栏 */}
      <aside className="w-[220px] bg-dark text-white flex flex-col shrink-0">
        <div className="h-14 flex items-center px-5 font-black text-lg border-b border-white/10">
          矿配云 <span className="text-accent ml-1">Admin</span>
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
          <div className="text-xs text-white/60">👤 {session.user?.name}</div>
          <Link href="/" className="block text-xs text-white/40 hover:text-white">← 返回前台</Link>
          <LogoutButton />
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
