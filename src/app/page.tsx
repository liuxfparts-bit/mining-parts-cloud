import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const hotSearches = ["掘进机", "采煤机", "轴承", "连续采煤机", "电子围栏"];
const equipmentCats = ["连续采煤机", "锚杆钻机", "梭车", "无轨胶轮车", "采煤机", "掘进机", "钻机", "长壁设备"];
const systemCats = ["液压系统", "电气系统", "发动机", "传动系统", "行走系统", "制动系统", "结构件", "滤芯/过滤器"];

export default async function HomePage() {
  await auth();

  const [brands, equipment, partNumbers, suppliers, recentRFQs, homeBanners, brandsWithEquipment, categories] = await Promise.all([
    prisma.brand.findMany({ include: { _count: { select: { equipment: true, partNumbers: true } } }, take: 12, orderBy: { name: "asc" } }),
    prisma.equipment.findMany({ where: { status: "ACTIVE" }, include: { brand: true, _count: { select: { partNumbers: true } } }, take: 8, orderBy: { id: "asc" } }),
    prisma.partNumber.findMany({
      include: { brand: true, equipment: { include: { brand: true } }, products: { where: { status: "PUBLISHED" }, include: { supplier: true } } },
      take: 6, orderBy: { id: "asc" },
    }),
    prisma.supplier.findMany({ where: { verifiedStatus: "VERIFIED" }, include: { _count: { select: { products: true } } }, take: 8, orderBy: { id: "asc" } }),
    prisma.rFQ.findMany({ where: { status: "COLLECTING" }, take: 6, orderBy: { createdAt: "desc" }, include: { partNumber: true } }),
    prisma.banner.findMany({ where: { status: "ACTIVE" }, orderBy: [{ sortOrder: "asc" }, { id: "desc" }] }),
    prisma.brand.findMany({ where: { equipment: { some: { status: "ACTIVE" } } }, include: { equipment: { where: { status: "ACTIVE" }, take: 6, orderBy: { id: "desc" } }, _count: { select: { partNumbers: true } } }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ take: 16, orderBy: { sortOrder: "asc" } }),
  ]);
  if (homeBanners.length > 0) {
    await prisma.banner.updateMany({ where: { id: { in: homeBanners.map((b) => b.id) } }, data: { impressions: { increment: 1 } } }).catch(() => {});
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            { "@context": "https://schema.org", "@type": "Organization", name: "矿配云 Mining Parts Cloud", url: "https://kuangpeiyun.com", description: "中国矿山设备与配件专业展示、找货与询价平台" },
            { "@context": "https://schema.org", "@type": "WebSite", name: "矿配云", url: "https://kuangpeiyun.com", potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: "https://kuangpeiyun.com/search?q={search_term_string}" }, "query-input": "required name=search_term_string" } },
            { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "首页", item: "https://kuangpeiyun.com" }] },
          ]),
        }}
      />
      {/* Hero */}
      <section className="relative text-white py-14 md:py-16 overflow-hidden"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 20%, rgba(245,158,11,0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(59,130,246,0.12), transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)`,
        }}>
        <div className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
        <div className="container relative text-center">
          <h1 className="text-3xl md:text-4xl font-bold">找矿山设备与配件，就上矿配云</h1>
          <p className="text-gray-400 mt-2">找设备 · 找配件 · 找厂家 · 发询价</p>
          <form action="/search" className="max-w-2xl mx-auto mt-6 flex bg-white rounded-lg overflow-hidden shadow-lg">
            <input name="q" placeholder="输入件号、设备型号、产品名称或品牌，如 XP210162 / MB670-1 / CL210" className="flex-1 px-5 py-3 text-gray-900 outline-none" />
            <button className="bg-[#F59E0B] text-white px-6 font-bold">搜索</button>
          </form>
          <div className="flex justify-center gap-3 mt-4 text-xs flex-wrap">
            {hotSearches.map((s) => <Link key={s} href={`/search?q=${s}`} className="text-gray-300 hover:text-white">{s}</Link>)}
          </div>
          <div className="flex justify-center gap-3 mt-5 flex-wrap">
            <Link href="/rfq/create" className="bg-[#F59E0B] text-white px-5 py-2.5 rounded font-medium">免费发布询价</Link>
            <Link href="/part-number" className="border border-white/30 px-5 py-2.5 rounded">免费找货</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 text-xs max-w-3xl mx-auto">
            <div className="border border-white/10 rounded p-3">覆盖主流矿山设备品牌</div>
            <div className="border border-white/10 rounded p-3">支持件号精准找货</div>
            <div className="border border-white/10 rounded p-3">供应商直接报价</div>
            <div className="border border-white/10 rounded p-3">免费发布询价</div>
          </div>
        </div>
      </section>

      {/* 顶部广告 */}
      {homeBanners.length > 0 && (
        <section className="container py-4">
          {homeBanners.map((b) => (
            <a key={b.id} href={`/api/banner/click/${b.id}`} target="_blank" className="block">
              <img src={b.imageUrl} alt={b.title} className="w-full rounded-lg border" />
            </a>
          ))}
        </section>
      )}

      {/* 快速找货 */}
      <section className="container py-8">
        <h2 className="text-xl font-bold mb-3">快速找货</h2>
        <div className="bg-white border rounded p-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => <Link key={c.id} href={`/search?q=${encodeURIComponent(c.name)}`} className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">{c.name}</Link>)}
            {categories.length === 0 && <span className="text-xs text-gray-400">数据库暂无分类，请先在后台添加配件分类</span>}
          </div>
        </div>
        <div className="mt-3 text-sm text-blue-600">不知道件号？<Link href="/equipment">按设备找配件 →</Link></div>
      </section>

      <main className="container pb-12 space-y-10">
        {/* 热门品牌 */}
        <section>
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
        <section className="bg-slate-50 -mx-4 px-4 py-8 rounded">
          <div className="flex justify-between items-end mb-3"><h2 className="text-xl font-bold">热门矿山设备</h2><Link href="/equipment" className="text-sm text-blue-600">全部 <ArrowRight className="inline h-3 w-3" /></Link></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {equipment.map((e) => (
              <Link key={e.id} href={`/equipment/${e.slug}`} className="bg-white border rounded p-4 hover:shadow">
                <div className="h-24 bg-gradient-to-br from-slate-700 to-slate-900 rounded mb-3 flex items-center justify-center text-white text-2xl font-bold overflow-hidden relative">
                  {e.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.imageUrl} alt={e.model} className="absolute inset-0 w-full h-full object-cover" />
                  ) : e.brand.name[0]}
                </div>
                <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">{e.brand.name}</span>
                <div className="font-bold mt-2">{e.model}</div>
                <div className="text-xs text-gray-500">{e.equipmentType}</div>
                <div className="text-xs text-gray-400 mt-1">{e._count.partNumbers} 个相关件号</div>
              </Link>
            ))}
          </div>
        </section>

        {/* 热门件号 */}
        <section>
          <div className="flex justify-between items-end mb-3">
            <div><h2 className="text-xl font-bold">热门件号</h2><p className="text-xs text-gray-500 mt-1">按件号精准找货</p></div>
            <Link href="/part-number" className="text-sm text-blue-600">件号数据库 <ArrowRight className="inline h-3 w-3" /></Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {partNumbers.map((p) => {
              const supplierCount = new Set(p.products.map((x) => x.supplierId)).size;
              const prices = p.products.map((x) => x.price).filter((v): v is number => v !== null);
              return (
                <Link key={p.id} href={`/part-number/${p.slug}`} className="bg-white border rounded p-4 hover:shadow block">
                  <div className="font-mono font-bold text-blue-700 text-lg">{p.number}</div>
                  <div className="mt-1">{p.name}</div>
                  <div className="flex gap-2 mt-2 text-xs">
                    {p.brand && <span className="bg-gray-100 px-2 py-0.5 rounded">{p.brand.name}</span>}
                    {p.equipment && <span className="bg-gray-100 px-2 py-0.5 rounded">{p.equipment.model}</span>}
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs text-gray-500">{supplierCount > 0 ? `${supplierCount} 家供应商` : "暂无供应商"}</span>
                    {prices.length > 0 && <span className="text-orange-600 font-bold">¥{Math.min(...prices)} 起</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 按设备找配件 */}
        <section>
          <div className="flex justify-between items-end mb-3">
            <div><h2 className="text-xl font-bold">按设备找配件</h2><p className="text-xs text-gray-500 mt-1">不知道件号？选择设备型号，快速查看相关配件</p></div>
            <Link href="/equipment" className="text-sm text-blue-600">全部设备 <ArrowRight className="inline h-3 w-3" /></Link>
          </div>
          <div className="bg-white border rounded divide-y">
            {brandsWithEquipment.map((b) => (
              <div key={b.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 p-4">
                <div className="w-40 shrink-0 font-bold">{b.name}</div>
                <div className="flex flex-wrap gap-2 flex-1">
                  {b.equipment.length === 0 ? <span className="text-xs text-gray-400">暂无设备</span> :
                    b.equipment.map((e) => (
                      <Link key={e.id} href={`/equipment/${e.slug}`} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">{e.model}</Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 最新询价 */}
        <section className="bg-slate-50 -mx-4 px-4 py-8 rounded">
          <div className="flex justify-between items-end mb-3"><h2 className="text-xl font-bold">最新公开询价</h2><Link href="/rfq" className="text-sm text-blue-600">进入询价大厅 <ArrowRight className="inline h-3 w-3" /></Link></div>
          {recentRFQs.length === 0 ? (
            <div className="bg-white border rounded p-8 text-center text-gray-500">目前暂无公开询价，<Link href="/rfq/create" className="text-blue-600">立即发布</Link></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentRFQs.map((r) => (
                <div key={r.id} className="bg-white border rounded p-4">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-gray-500 mt-1">件号：{r.partNumberStr || r.partNumber?.number || "-"} · 数量：{r.quantity} {r.unit}</div>
                  <div className="text-xs text-gray-400 mt-1">{r.createdAt.toLocaleDateString()}</div>
                  <Link href={`/rfq/${r.id}`} className="text-sm text-blue-600 mt-2 inline-block">查看询价 →</Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 优质供应商 */}
        <section>
          <div className="flex justify-between items-end mb-3"><h2 className="text-xl font-bold">优质供应商</h2><Link href="/suppliers" className="text-sm text-blue-600">全部 <ArrowRight className="inline h-3 w-3" /></Link></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {suppliers.map((s) => (
              <Link key={s.id} href={`/suppliers/${s.slug}`} className="bg-white border rounded p-4 hover:shadow block">
                <div className="font-bold">{s.name}</div>
                <span className="inline-block mt-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">✓ 已认证</span>
                <div className="text-xs text-gray-500 mt-2">产品 {s._count.products} 个</div>
              </Link>
            ))}
          </div>
        </section>

        {/* 底部转化 CTA */}
        <section className="bg-slate-900 text-white rounded p-8 text-center">
          <h2 className="text-xl font-bold">找不到需要的配件？</h2>
          <p className="text-gray-300 mt-2 text-sm">把设备型号 / 件号 / 产品名称 / 数量告诉我们，供应商会根据询价进行报价。</p>
          <Link href="/rfq/create" className="inline-block mt-4 bg-[#F59E0B] text-white px-6 py-2.5 rounded font-medium">免费发布询价</Link>
        </section>
      </main>
    </>
  );
}
