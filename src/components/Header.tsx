import Link from "next/link";
import { Search, LogIn, Building2 } from "lucide-react";
import { auth } from "@/lib/auth";
import HomeNavigation from "@/components/HomeNavigation";
import UserMenu from "@/components/UserMenu";

const navItems = [
  { label: "首页", href: "/" },
  { label: "找设备", href: "/equipment" },
  { label: "找件号", href: "/part-number" },
  { label: "找厂家", href: "/suppliers" },
  { label: "询价大厅", href: "/rfqs" },
];

export default async function Header() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const name = (session?.user as any)?.name || (session?.user as any)?.email || "用户";

  return (
    <header className="bg-white border-b border-line sticky top-0 z-50 shadow-sm">
      <HomeNavigation name={session ? name : undefined} role={role} />
      <div className="container original-navigation">
        <div className="flex items-center h-[64px] gap-6">
          <Link href="/" className="shrink-0" aria-label="矿配云首页">
            <img src="/brand/kpy-logo-20261028.png" alt="矿配云 Kuangpeiyun" width={166} height={56} className="w-[166px] h-auto" />
          </Link>
          <nav className="hidden lg:flex items-center gap-5 text-sm flex-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-ink/80 hover:text-accent transition-colors whitespace-nowrap">{item.label}</Link>
            ))}
            {role === "ADMIN" && (
              <Link href="/admin" className="text-accent font-bold">平台审核</Link>
            )}
          </nav>
          <div className="flex items-center gap-3 ml-auto shrink-0">
            {!session ? (
              <>
                <Link href="/login" className="flex items-center gap-1 text-sm text-ink/70 hover:text-accent">
                  <LogIn size={15} /> 登录
                </Link>
                <Link href="/register" className="flex items-center gap-1 bg-accent text-ink font-bold px-4 py-2 rounded-md hover:bg-[#d49215] text-sm">
                  <Building2 size={15} /> 企业入驻
                </Link>
              </>
            ) : (
              <UserMenu name={name} role={role} />
            )}
          </div>
        </div>
        <div className="lg:hidden pb-3">
          <form action="/search" className="relative">
            <input name="q" placeholder="搜索设备型号、件号、品牌…" className="w-full border rounded pl-10 pr-4 py-2 text-sm bg-[#f7f8f9]" />
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          </form>
        </div>
      </div>
    </header>
  );
}
