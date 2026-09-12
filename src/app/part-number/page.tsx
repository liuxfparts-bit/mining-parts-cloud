import Link from "next/link";
import { prisma } from "@/lib/db";
import Pagination from "@/components/Pagination";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "矿山设备配件件号数据库｜矿配云",
  description: "矿配云矿山设备配件件号数据库，支持按件号、品牌、设备型号和配件分类查询矿山设备配件信息及供应商。",
};

export default async function PartNumbersPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const q = (searchParams.q || "").trim();
  const brandId = searchParams.brandId ? parseInt(searchParams.brandId) : null;
  const equipmentId = searchParams.equipmentId ? parseInt(searchParams.equipmentId) : null;
  const categoryId = searchParams.categoryId ? parseInt(searchParams.categoryId) : null;
  const pageSize = searchParams.pageSize ? Math.min(100, Math.max(10, parseInt(searchParams.pageSize))) : 20;
  const page = searchParams.page ? Math.max(1, parseInt(searchParams.page)) : 1;

  const where: any = {};
  const and: any[] = [];

  if (q) {
    and.push({
      OR: [
        { number: { contains: q } },
        { name: { contains: q } },
        { nameEn: { contains: q } },
        { brand: { name: { contains: q } } },
        { brand: { nameEn: { contains: q } } },
        { equipment: { model: { contains: q } } },
        { equipment: { name: { contains: q } } },
      ],
    });
  }
  if (brandId) and.push({ brandId });
  if (equipmentId) and.push({ equipmentId });
  if (categoryId) and.push({ categoryId });
  if (and.length) where.AND = and;

  const [total, partNumbers, brands, equipments, categories] = await Promise.all([
    prisma.partNumber.count({ where }),
    prisma.partNumber.findMany({
      where,
      include: {
        brand: true,
        equipment: { include: { brand: true } },
        products: { where: { status: "PUBLISHED" }, include: { supplier: true } },
      },
      orderBy: { number: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, nameEn: true } }),
    prisma.equipment.findMany({ where: { status: "ACTIVE" }, orderBy: { model: "asc" }, select: { id: true, model: true, name: true } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const setParam = (key: string, val: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (brandId) sp.set("brandId", String(brandId));
    if (equipmentId) sp.set("equipmentId", String(equipmentId));
    if (categoryId) sp.set("categoryId", String(categoryId));
    sp.set(key, val);
    if (key !== "pageSize") sp.set("page", "1");
    return `/part-number?${sp.toString()}`;
  };

  const reset = () => "/part-number";

  return (
    <div className="container py-[42px]">
      <h1 className="text-3xl font-bold mb-2">件号数据库</h1>
      <p className="text-muted mb-6">按件号、品牌、设备型号或配件分类查找矿山设备配件及供应商</p>

      {/* 搜索框 */}
      <form method="get" action="/part-number" className="bg-white border rounded p-3 mb-3 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="搜索件号、配件名称、设备型号、品牌……"
          className="flex-1 border rounded px-3 py-2 text-sm outline-none"
        />
        <button className="bg-amber-500 text-white px-4 rounded text-sm font-bold">搜索</button>
      </form>

      {/* 筛选器 */}
      <form method="get" action="/part-number" className="bg-white border rounded p-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <input type="hidden" name="q" value={q} />
        <select name="brandId" defaultValue={brandId ?? ""} className="border rounded px-2 py-1.5">
          <option value="">全部品牌</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name} {b.nameEn ? `(${b.nameEn})` : ""}</option>)}
        </select>
        <select name="equipmentId" defaultValue={equipmentId ?? ""} className="border rounded px-2 py-1.5">
          <option value="">全部设备</option>
          {equipments.map((e) => <option key={e.id} value={e.id}>{e.model} {e.name ? `· ${e.name}` : ""}</option>)}
        </select>
        <select name="categoryId" defaultValue={categoryId ?? ""} className="border rounded px-2 py-1.5">
          <option value="">全部分类</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="bg-slate-900 text-white px-3 py-1.5 rounded flex-1">应用筛选</button>
          <Link href={reset} className="border px-3 py-1.5 rounded">重置</Link>
        </div>
      </form>

      <p className="text-sm text-muted mb-3">共 {total} 个相关件号</p>

      {/* 列表 */}
      {partNumbers.length === 0 ? (
        <div className="bg-white border rounded p-8 text-center">
          <p className="mb-3">未找到匹配件号。</p>
          <Link href="/part-number/request" className="text-amber-600 underline">提交新件号申请</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
          {partNumbers.map((p) => {
            const publishedSuppliers = new Set(p.products.map((pr) => pr.supplierId)).size;
            const prices = p.products.map((pr) => pr.price).filter((v): v is number => v !== null);
            return (
              <Link key={p.id} href={`/part-number/${p.slug}`} className="bg-white border rounded p-4 hover:shadow block">
                <div className="font-mono font-bold text-amber-600">{p.number}</div>
                <div className="font-medium mt-1">{p.name}</div>
                {p.nameEn && <div className="text-xs text-muted">{p.nameEn}</div>}
                <div className="text-xs text-muted mt-2">
                  {p.brand?.name}{p.equipment ? ` · ${p.equipment.model}` : ""}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted">
                    {publishedSuppliers > 0 ? `供应商 ${publishedSuppliers} 家` : "暂无公开供应商"}
                    {prices.length > 0 && ` · ¥${Math.min(...prices)} 起`}
                  </span>
                  <span className="text-amber-600 text-xs">查看件号 →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      <div className="mt-6">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          baseQuery={new URLSearchParams(
            Object.entries({ q, brandId: brandId ? String(brandId) : "", equipmentId: equipmentId ? String(equipmentId) : "", categoryId: categoryId ? String(categoryId) : "" }).filter(([, v]) => v) as [string, string][]
          )}
        />
        <div className="text-xs text-muted mt-2">
          每页
          {[20, 50, 100].map((s) => (
            <Link key={s} href={setParam("pageSize", String(s))} className={`ml-2 px-2 py-0.5 rounded ${pageSize === s ? "bg-amber-500 text-white" : "border"}`}>{s}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
