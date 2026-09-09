import Link from "next/link";
import { Search, LogIn, Building2 } from "lucide-react";

const navItems = [
  { label: "首页", href: "/" },
  { label: "找设备", href: "/equipment" },
  { label: "找配件", href: "/part-number" },
  { label: "找厂家", href: "/suppliers" },
  { label: "询价大厅", href: "/rfq" },
  { label: "二手设备", href: "/used-equipment" },
  { label: "维修服务", href: "/services" },
  { label: "行业资讯", href: "/news" },
];

export default function Header() {
  return (
    <header className="bg-white border-b border-line sticky top-0 z-50 shadow-sm">
      <div className="container">
        {/* 主导航行 */}
        <div className="flex items-center h-[64px] gap-6">
          {/* LOGO */}
          <Link href="/" className="font-black text-2xl tracking-tight text-ink shrink-0">
            矿配<span className="text-accent">云</span>
          </Link>

          {/* 导航 */}
          <nav className="hidden lg:flex items-center gap-5 text-sm flex-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-ink/80 hover:text-accent transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* 右侧操作 */}
          <div className="flex items-center gap-3 ml-auto shrink-0">
            <Link
              href="/login"
              className="flex items-center gap-1 text-sm text-ink/70 hover:text-accent"
            >
              <LogIn size={15} /> 登录
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-1 bg-accent text-ink font-bold px-4 py-2 rounded-md hover:bg-[#d49215] transition-colors text-sm"
            >
              <Building2 size={15} /> 企业入驻
            </Link>
          </div>
        </div>

        {/* 移动端搜索条 */}
        <div className="lg:hidden pb-3">
          <form action="/search" className="relative">
            <input
              type="text"
              name="q"
              placeholder="搜索设备型号、件号、品牌…"
              className="w-full border border-line rounded-md pl-10 pr-4 py-2 text-sm bg-[#f7f8f9]"
            />
            <Search size={16} className="absolute left-3 top-2.5 text-muted" />
          </form>
        </div>
      </div>
    </header>
  );
}
