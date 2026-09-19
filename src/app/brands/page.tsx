import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  let brands: any[] = [];
  try {
    brands = await prisma.brand.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, slug: true, name: true, nameEn: true, country: true, logo: true },
      orderBy: { name: "asc" },
    });
  } catch (e) {
    console.error("【/brands 页数据加载失败堆栈】:", e);
    brands = [];
  }

  // 单独查 counts，避免 _count 关联名不一致崩整页
  const countsMap: Record<number, { equipment: number; partNumbers: number }> = {};
  try {
    const [eqGroups, pnGroups] = await Promise.all([
      prisma.equipment.groupBy({ by: ["brandId"], _count: true }),
      prisma.partNumber.groupBy({ by: ["brandId"], where: { publishStatus: "READY" }, _count: true }),
    ]);
    for (const g of eqGroups) if (g.brandId) countsMap[g.brandId] = { equipment: g._count, partNumbers: 0 };
    for (const g of pnGroups) {
      if (!g.brandId) continue;
      if (!countsMap[g.brandId]) countsMap[g.brandId] = { equipment: 0, partNumbers: 0 };
      countsMap[g.brandId].partNumbers = g._count;
    }
  } catch (e) {
    console.error("【/brands 统计失败】:", e);
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const grouped: Record<string, any[]> = {};
  for (const b of brands) {
    const ch = (b.nameEn || b.name || "").charAt(0).toUpperCase();
    const key = /[A-Z]/.test(ch) ? ch : "#";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(b);
  }

  const countFor = (id: number) => countsMap[id] || { equipment: 0, partNumbers: 0 };

  return (
    <div className="container py-[42px]">
      <h1 className="text-3xl font-bold mb-2">品牌库</h1>
      <p className="text-muted mb-6">按品牌浏览设备和件号，共 {brands.length} 个品牌</p>

      <div className="flex flex-wrap gap-1 mb-8 text-sm">
        {letters.map((l) => (
          <a key={l} href={`#letter-${l}`}
             className="w-8 h-8 leading-8 text-center border rounded hover:bg-amber-50 hover:border-amber-400">
            {l}
          </a>
        ))}
        <a href="#letter-#" className="w-8 h-8 leading-8 text-center border rounded hover:bg-amber-50 hover:border-amber-400">#</a>
      </div>

      {brands.length === 0 && (
        <div className="text-center py-16 text-muted">暂无品牌数据</div>
      )}

      {letters.map((l) =>
        grouped[l] ? (
          <section key={l} id={`letter-${l}`} className="mb-8">
            <h2 className="text-xl font-bold mb-3 border-l-4 border-amber-500 pl-2">{l}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
              {grouped[l].map((b) => {
                const c = countFor(b.id);
                return (
                  <Link key={b.id} href={`/brands/${b.slug}`}
                        className="bg-white border rounded-lg hover:shadow-md overflow-hidden">
                    <div className="aspect-[16/9] bg-slate-100 flex items-center justify-center overflow-hidden">
                      {b.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logo} alt={b.name} className="max-h-full max-w-full object-contain p-3" />
                      ) : (
                        <span className="text-3xl font-black text-slate-300">{(b.name || "?").charAt(0)}</span>
                      )}
                    </div>
                    <div className="p-3 text-center">
                      <div className="font-bold">{b.name}</div>
                      {b.nameEn && <div className="text-xs text-muted">{b.nameEn}</div>}
                      <div className="text-xs text-muted mt-2">
                        设备 {c.equipment} · 件号 {c.partNumbers}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null
      )}

      {grouped["#"] && (
        <section id="letter-#" className="mb-8">
          <h2 className="text-xl font-bold mb-3 border-l-4 border-amber-500 pl-2">#</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
            {grouped["#"].map((b) => {
              const c = countFor(b.id);
              return (
                <Link key={b.id} href={`/brands/${b.slug}`}
                      className="bg-white border rounded-lg hover:shadow-md overflow-hidden">
                  <div className="aspect-[16/9] bg-slate-100 flex items-center justify-center">
                    {b.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.logo} alt={b.name} className="max-h-full max-w-full object-contain p-3" />
                    ) : (
                      <span className="text-3xl font-black text-slate-300">{(b.name || "?").charAt(0)}</span>
                    )}
                  </div>
                  <div className="p-3 text-center">
                    <div className="font-bold">{b.name}</div>
                    {b.nameEn && <div className="text-xs text-muted">{b.nameEn}</div>}
                    <div className="text-xs text-muted mt-2">
                      设备 {c.equipment} · 件号 {c.partNumbers}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-10 bg-slate-50 border rounded-lg p-6 text-center">
        <p className="mb-3">没有找到您需要的品牌？</p>
        <Link href="/contact" className="inline-block bg-amber-500 text-white px-5 py-2 rounded font-bold">
          联系平台申请新增品牌
        </Link>
      </div>
    </div>
  );
}
