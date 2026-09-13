import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  let brands: any[] = [];
  try {
    brands = await prisma.brand.findMany({
      include: { _count: { select: { equipment: true, partNumbers: true } } },
      orderBy: { name: "asc" },
    });
  } catch (e) {
    console.error("[brands] query error", e);
  }
  brands = brands || [];

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const grouped: Record<string, typeof brands> = {};
  for (const b of brands) {
    const ch = (b.nameEn || b.name).charAt(0).toUpperCase();
    const key = /[A-Z]/.test(ch) ? ch : "#";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(b);
  }

  return (
    <div className="container py-[42px]">
      <h1 className="text-3xl font-bold mb-2">品牌库</h1>
      <p className="text-muted mb-6">按品牌浏览设备和件号，共 {brands.length} 个品牌</p>

      {/* A-Z 字母索引 */}
      <div className="flex flex-wrap gap-1 mb-8 text-sm">
        {letters.map((l) => (
          <a key={l} href={`#letter-${l}`}
             className="w-8 h-8 leading-8 text-center border rounded hover:bg-amber-50 hover:border-amber-400">
            {l}
          </a>
        ))}
        <a href="#letter-#" className="w-8 h-8 leading-8 text-center border rounded hover:bg-amber-50 hover:border-amber-400">#</a>
      </div>

      {letters.map((l) =>
        grouped[l] ? (
          <section key={l} id={`letter-${l}`} className="mb-8">
            <h2 className="text-xl font-bold mb-3 border-l-4 border-amber-500 pl-2">{l}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
              {grouped[l].map((b) => (
                <Link key={b.id} href={`/brands/${b.slug}`}
                      className="bg-white border rounded-lg hover:shadow-md overflow-hidden group">
                  <div className="aspect-[16/9] bg-slate-100 flex items-center justify-center overflow-hidden">
                    {b.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.logo} alt={b.name}
                           className="max-h-full max-w-full object-contain p-3"
                           onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <span className="text-3xl font-black text-slate-300">{b.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="p-3 text-center">
                    <div className="font-bold">{b.name}</div>
                    {b.nameEn && <div className="text-xs text-muted">{b.nameEn}</div>}
                    <div className="text-xs text-muted mt-2">
                      设备 {b._count?.equipment ?? 0} · 件号 {b._count?.partNumbers ?? 0}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null
      )}

      {grouped["#"] && (
        <section id="letter-#" className="mb-8">
          <h2 className="text-xl font-bold mb-3 border-l-4 border-amber-500 pl-2">#</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
            {grouped["#"].map((b) => (
              <Link key={b.id} href={`/brands/${b.slug}`}
                    className="bg-white border rounded-lg hover:shadow-md overflow-hidden">
                <div className="aspect-[16/9] bg-slate-100 flex items-center justify-center">
                  {b.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logo} alt={b.name}
                         className="max-h-full max-w-full object-contain p-3"
                         onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <span className="text-3xl font-black text-slate-300">{b.name.charAt(0)}</span>
                  )}
                </div>
                <div className="p-3 text-center">
                  <div className="font-bold">{b.name}</div>
                  {b.nameEn && <div className="text-xs text-muted">{b.nameEn}</div>}
                  <div className="text-xs text-muted mt-2">
                    设备 {b._count.equipment} · 件号 {b._count.partNumbers}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 底部引导 */}
      <div className="mt-10 bg-slate-50 border rounded-lg p-6 text-center">
        <p className="mb-3">没有找到您需要的品牌？</p>
        <Link href="/contact" className="inline-block bg-amber-500 text-white px-5 py-2 rounded font-bold">
          联系平台申请新增品牌
        </Link>
      </div>
    </div>
  );
}
