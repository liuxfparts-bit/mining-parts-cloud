export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function MobileHome() {
  const [equipment, partNumbers] = await Promise.all([
    prisma.equipment.findMany({ include: { brand: true, _count: { select: { partNumbers: true } } }, take: 20, orderBy: { id: "asc" } }),
    prisma.partNumber.findMany({
      include: { brand: true, products: { where: { status: "PUBLISHED" } } },
      take: 10, orderBy: { id: "asc" },
    }),
  ]);

  const shortcuts = [
    { label: "找件号", href: "/part-number", icon: "🔢" },
    { label: "找设备", href: "/equipment", icon: "⚙️" },
    { label: "询价大厅", href: "/rfqs", icon: "📢" },
    { label: "优选厂家", href: "/suppliers", icon: "🏭" },
    { label: "我的", href: "/login", icon: "👤" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 bg-[#1F2937] text-white px-4 py-3 shadow">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg whitespace-nowrap">矿配云</span>
          <form action="/search" className="flex-1 flex bg-white rounded-full overflow-hidden">
            <input name="q" placeholder="搜设备型号、件号、品牌..." className="flex-1 px-4 py-1.5 text-sm text-gray-900 outline-none" />
            <button className="bg-[#F59E0B] text-white px-3 text-sm">搜索</button>
          </form>
          <Link href="/login" className="text-xs">工作台</Link>
        </div>
      </header>

      {/* Banner */}
      <section className="bg-[#1F2937] text-white px-4 py-8 text-center">
        <h1 className="text-xl font-bold">找设备 · 找配件 · 找厂家 · 发询价</h1>
        <p className="text-gray-400 text-xs mt-1">B2B 矿山备件一站式平台</p>
        <Link href="/rfq/create" className="inline-block mt-4 bg-[#F59E0B] text-white font-bold px-8 py-3 rounded-full">一键发布询价</Link>
      </section>

      {/* Shortcuts */}
      <section className="bg-white mx-3 -mt-2 rounded-lg shadow grid grid-cols-5 py-4">
        {shortcuts.map((s) => (
          <Link key={s.label} href={s.href} className="flex flex-col items-center gap-1">
            <span className="text-2xl">{s.icon}</span>
            <span className="text-xs text-gray-700">{s.label}</span>
          </Link>
        ))}
      </section>

      {/* Equipment horizontal scroll */}
      <section className="mt-4">
        <h2 className="px-4 text-base font-bold mb-2">热门矿山设备</h2>
        <div className="flex gap-3 overflow-x-auto px-4 pb-2">
          {equipment.map((e) => (
            <Link key={e.id} href={`/equipment/${e.slug}`} className="min-w-[160px] bg-white border rounded-lg p-3 shrink-0">
              <span className="inline-block bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded">{e.brand.name}</span>
              <div className="font-bold mt-1">{e.model}</div>
              <div className="text-xs text-gray-500">{e.equipmentType}</div>
              <div className="text-xs text-gray-400 mt-1">{e._count.partNumbers} 个件号</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Part numbers 2-col */}
      <section className="mt-4">
        <h2 className="px-4 text-base font-bold mb-2">热门件号</h2>
        <div className="grid grid-cols-2 gap-3 px-4">
          {partNumbers.map((p) => {
            const prices = p.products.map((x) => x.price).filter((v): v is number => v !== null);
            return (
              <Link key={p.id} href={`/part-number/${p.slug}`} className="bg-white border rounded-lg p-3">
                <div className="font-mono font-bold text-blue-700">{p.number}</div>
                <div className="text-sm mt-0.5">{p.name}</div>
                <span className="inline-block bg-gray-100 text-xs px-1.5 py-0.5 rounded mt-1">{p.brand?.name}</span>
                <div className="text-xs text-gray-500 mt-1">{p.products.length} 家供应商</div>
                {prices.length > 0 && <div className="text-sm font-bold text-orange-600 mt-1">¥{Math.min(...prices)} 起</div>}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Lightweight Footer */}
      <footer className="bg-[#1F2937] text-gray-400 text-xs text-center py-4 mt-6">
        <div className="flex justify-center gap-3 mb-2">
          <Link href="/about" className="hover:text-white">关于我们</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-white">服务协议</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-white">隐私政策</Link>
        </div>
        <div>© 2026 矿配云 · 晋ICP备xxxxxxxx号</div>
      </footer>

      {/* TabBar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t grid grid-cols-5 z-20 pb-[env(safe-area-inset-bottom)]">
        <Link href="/m" className="flex flex-col items-center py-2 text-gray-600">
          <span className="text-lg">🏠</span><span className="text-[10px]">首页</span>
        </Link>
        <Link href="/search" className="flex flex-col items-center py-2 text-gray-600">
          <span className="text-lg">🔍</span><span className="text-[10px]">搜索</span>
        </Link>
        <div className="relative flex flex-col items-center">
          <Link href="/rfq/create" className="absolute -top-5 w-12 h-12 bg-[#F59E0B] text-white rounded-full flex items-center justify-center shadow-lg border-4 border-white text-xl">
            +
          </Link>
          <span className="text-[10px] text-[#F59E0B] mt-8 font-bold">发询价</span>
        </div>
        <Link href="/suppliers" className="flex flex-col items-center py-2 text-gray-600">
          <span className="text-lg">🏭</span><span className="text-[10px]">企业</span>
        </Link>
        <Link href="/login" className="flex flex-col items-center py-2 text-gray-600">
          <span className="text-lg">👤</span><span className="text-[10px]">我的</span>
        </Link>
      </nav>
    </div>
  );
}
