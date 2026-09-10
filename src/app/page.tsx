import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const user = session?.user ? await prisma.user.findUnique({ where: { email: (session.user as any).email } }) : null;
  const role = (session?.user as any)?.role;

  const [brandCount, equipmentCount, partNumberCount, productCount, supplierCount, rfqCount] = await Promise.all([
    prisma.brand.count(),
    prisma.equipment.count(),
    prisma.partNumber.count(),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.supplier.count(),
    prisma.rFQ.count({ where: { status: "COLLECTING" } }),
  ]);

  const [brands, equipment, partNumbers, suppliers, recentRFQs] = await Promise.all([
    prisma.brand.findMany({ include: { _count: { select: { equipment: true, partNumbers: true } } }, take: 10, orderBy: { name: "asc" } }),
    prisma.equipment.findMany({ include: { brand: true, _count: { select: { partNumbers: true } } }, take: 8, orderBy: { id: "asc" } }),
    prisma.partNumber.findMany({
      include: { brand: true, equipment: { include: { brand: true } }, products: { where: { status: "PUBLISHED" }, include: { supplier: true } } },
      take: 6, orderBy: { id: "asc" },
    }),
    prisma.supplier.findMany({ where: { verifiedStatus: "VERIFIED" }, include: { _count: { select: { products: true } } }, take: 4, orderBy: { id: "asc" } }),
    prisma.rFQ.findMany({ take: 4, orderBy: { createdAt: "desc" }, include: { partNumber: true } }),
  ]);

  const equipmentCats = ["连续采煤机", "锚杆钻车", "梭车", "地下铲运机", "掘进机", "采煤机", "凿岩台车", "长壁设备"];
  const systemCats = ["液压系统", "电气控制", "发动机", "传动系统", "行走系统", "制动系统", "结构件", "滤芯维护"];

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="container flex items-center justify-between h-14">
          <Link href="/" className="font-bold text-xl">矿配云</Link>
          <nav className="flex gap-4 text-sm items-center">
            <Link href="/equipment" className="hover:text-blue-600">找设备</Link>
            <Link href="/part-number" className="hover:text-blue-600">找件号</Link>
            <Link href="/suppliers" className="hover:text-blue-600">找厂家</Link>
            <Link href="/rfqs" className="hover:text-blue-600">询价大厅</Link>
            {!session ? (
              <>
                <Link href="/login" className="text-gray-600">登录</Link>
                <Link href="/register" className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">企业入驻</Link>
              </>
            ) : (
              <>
                <span className="text-gray-600">{user?.name || "用户"}</span>
                {role === "ADMIN" && <Link href="/admin" className="text-blue-600">管理后台</Link>}
                {role === "SUPPLIER" && <Link href="/supplier" className="text-blue-600">供应商工作台</Link>}
                {role === "BUYER" && <Link href="/dashboard" className="text-blue-600">采购商中心</Link>}
                <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                  <button className="text-gray-500">退出</button>
                </form>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#1F2937] text-white py-16">
        <div className="container text-center">
          <h1 className="text-3xl md:text-4xl font-bold">中国矿山设备与配件专业平台</h1>
          <p className="text-gray-400 mt-2">找设备 · 找配件 · 找厂家 · 发询价</p>
          <form action="/search" className="max-w-2xl mx-auto mt-6 flex bg-white rounded-lg overflow-hidden shadow-lg">
            <input name="q" placeholder="输入件号、设备型号、品牌或配件名称，如 XP210162 / MB670-1" className="flex-1 px-5 py-3 text-gray-900 outline-none" />
            <button className="bg-[#F59E0B] text-white px-6 font-bold">搜索</button>
          </form>
          <div className="flex justify-center gap-4 mt-4 text-xs text-gray-400 flex-wrap">
            <Link href="/rfq/create" className="bg-[#F59E0B] text-white px-4 py-2 rounded">立即发布询价</Link>
            <Link href="/part-number" className="border border-white/30 px-4 py-2 rounded">免费找货</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 text-xs max-w-3xl mx-auto">
            <div className="border border-white/10 rounded p-3">件号数据 {partNumberCount}+</div>
            <div className="border border-white/10 rounded p-3">设备型号 {equipmentCount}+</div>
            <div className="border border-white/10 rounded p-3">专业供应商 {supplierCount}+</div>
            <div className="border border-white/10 rounded p-3">已发布产品 {productCount}+</div>
          </div>
        </div>
      </section>

      {/* 快速找货 */}
      <section className="container py-8">
        <h2 className="text-xl font-bold mb-3">快速找货</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border rounded p-4">
            <h3 className="font-bold mb-2">按设备找</h3>
            <div className="flex flex-wrap gap-2">
              {equipmentCats.map((c) => <Link key={c} href={`/search?q=${c}`} className="text-xs bg-gray-100 px-2 py-1 rounded">{c}</Link>)}
            </div>
          </div>
          <div className="bg-white border rounded p-4">
            <h3 className="font-bold mb-2">按系统找</h3>
            <div className="flex flex-wrap gap-2">
              {systemCats.map((c) => <Link key={c} href={`/search?q=${c}`} className="text-xs bg-gray-100 px-2 py-1 rounded">{c}</Link>)}
            </div>
          </div>
        </div>
      </section>

      <main className="container pb-12">
        {/* 热门品牌 */}
        <section className="py-6">
          <div className="flex justify-between items-end mb-3">
            <div><h2 className="text-xl font-bold">热门品牌</h2><p className="text-xs text-gray-500 mt-1">覆盖主流矿山设备品牌</p></div>
            <Link href="/brands" className="text-sm text-blue-600">全部 <ArrowRight className="inline h-3 w-3" /></Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3">
            {brands.map((b) => (
              <Link key={b.id} href={`/brands/${b.slug}`} className="bg-white border rounded-lg p-4 flex flex-col items-center justify-center h-[130px] hover:shadow">
                <div className="h-14 flex items-center justify-center">
                  {b.logo ? (
                    <img src={b.logo} alt={b.name} className="max-h-14 max-w-[120px] object-contain" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">{b.name[0]}</div>
                  )}
                </div>
                <div className="text-sm font-medium mt-2">{b.name}</div>
                <div className="text-[10px] text-gray-400">{b._count.partNumbers} 件号</div>
              </Link>
            ))}
          </div>
        </section>

        {/* 热门设备 */}
        <section className="py-6">
          <div className="flex justify-between items-end mb-3"><h2 className="text-xl font-bold">热门矿山设备</h2><Link href="/equipment" className="text-sm text-blue-600">全部 <ArrowRight className="inline h-3 w-3" /></Link></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {equipment.map((e) => (
              <Link key={e.id} href={`/equipment/${e.slug}`} className="bg-white border rounded p-4 hover:shadow">
                <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">{e.brand.name}</span>
                <div className="font-bold mt-2">{e.model}</div>
                <div className="text-xs text-gray-500">{e.equipmentType}</div>
                <div className="text-xs text-gray-400 mt-1">{e._count.partNumbers} 个相关件号</div>
              </Link>
            ))}
          </div>
        </section>

        {/* 热门件号 */}
        <section className="py-6">
          <div className="flex justify-between items-end mb-3"><h2 className="text-xl font-bold">热门件号</h2><Link href="/part-number" className="text-sm text-blue-600">件号数据库 <ArrowRight className="inline h-3 w-3" /></Link></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {partNumbers.map((p) => {
              const prices = p.products.map((x) => x.price).filter((v): v is number => v !== null);
              return (
                <div key={p.id} className="bg-white border rounded p-4">
                  <div className="font-mono font-bold text-blue-700 text-lg">{p.number}</div>
                  <div className="mt-1">{p.name}</div>
                  <div className="flex gap-2 mt-2 text-xs">
                    {p.brand && <span className="bg-gray-100 px-2 py-0.5 rounded">{p.brand.name}</span>}
                    {p.equipment && <span className="bg-gray-100 px-2 py-0.5 rounded">{p.equipment.model}</span>}
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs text-gray-500">{p.products.length} 家供应商</span>
                    {prices.length > 0 && <span className="text-orange-600 font-bold">¥{Math.min(...prices)} 起</span>}
                  </div>
                  <Link href={`/part-number/${p.slug}`} className="inline-block mt-3 text-sm text-blue-600">查看件号 →</Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* 最新询价 */}
        <section className="py-6">
          <div className="flex justify-between items-end mb-3"><h2 className="text-xl font-bold">最新公开询价</h2><Link href="/rfq/create" className="text-sm text-blue-600">发布询价 <ArrowRight className="inline h-3 w-3" /></Link></div>
          {recentRFQs.length === 0 ? (
            <div className="bg-white border rounded p-8 text-center text-gray-500">目前暂无公开询价，<Link href="/rfq/create" className="text-blue-600">立即发布</Link></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentRFQs.map((r) => (
                <div key={r.id} className="bg-white border rounded p-4">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-gray-500 mt-1">件号：{r.partNumberStr || r.partNumber?.number || "-"} · 数量：{r.quantity} {r.unit}</div>
                  <div className="text-xs text-gray-400 mt-1">{r.createdAt.toLocaleDateString()}</div>
                  <Link href={`/rfqs/${r.id}`} className="text-sm text-blue-600 mt-2 inline-block">查看询价 →</Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 优质供应商 */}
        <section className="py-6">
          <div className="flex justify-between items-end mb-3"><h2 className="text-xl font-bold">优质供应商</h2><Link href="/suppliers" className="text-sm text-blue-600">全部 <ArrowRight className="inline h-3 w-3" /></Link></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {suppliers.map((s) => (
              <div key={s.id} className="bg-white border rounded p-4">
                <div className="font-bold">{s.name}</div>
                <span className="inline-block mt-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">已认证</span>
                <div className="text-xs text-gray-500 mt-2">产品 {s._count.products} 个</div>
                <Link href={`/suppliers/${s.slug}`} className="text-sm text-blue-600 mt-2 inline-block">进入主页 →</Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 text-gray-400 text-xs py-6">
        <div className="container text-center">© 2026 矿配云 · 中国矿山设备与配件专业平台</div>
      </footer>
    </>
  );
}
