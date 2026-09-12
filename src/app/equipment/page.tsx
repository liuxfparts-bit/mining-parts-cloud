import Link from "next/link";
import { prisma } from "@/lib/db";
import Pagination from "@/components/Pagination";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "矿山设备数据库｜矿配云",
    description: "矿配云矿山设备数据库，支持按设备型号、设备名称、品牌和设备类型查找矿山设备及相关配件。",
  };
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const q = (searchParams.q || "").trim();
  const brandId = searchParams.brandId ? parseInt(searchParams.brandId) : null;
  const equipmentType = searchParams.equipmentType || "";
  const pageSize = searchParams.pageSize ? Math.min(100, Math.max(10, parseInt(searchParams.pageSize))) : 20;
  const page = searchParams.page ? Math.max(1, parseInt(searchParams.page)) : 1;

  const where: any = { status: "ACTIVE" };
  const and: any[] = [];
  if (q) {
    and.push({
      OR: [
        { model: { contains: q } },
        { name: { contains: q } },
        { nameEn: { contains: q } },
        { series: { contains: q } },
        { brand: { name: { contains: q } } },
        { brand: { nameEn: { contains: q } } },
      ],
    });
  }
  if (brandId) and.push({ brandId });
  if (equipmentType) and.push({ equipmentType });
  if (and.length) where.AND = and;

  const [total, equipment, brands, types] = await Promise.all([
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({
      where,
      include: { brand: true, _count: { select: { partNumbers: true } } },
      orderBy: { id: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, nameEn: true } }),
    prisma.equipment.findMany({ where: { status: "ACTIVE" }, distinct: ["equipmentType"], select: { equipmentType: true }, orderBy: { equipmentType: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const setParam = (key: string, val: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (brandId) sp.set("brandId", String(brandId));
    if (equipmentType) sp.set("equipmentType", equipmentType);
    sp.set(key, val);
    if (key !== "pageSize") sp.set("page", "1");
    return `/equipment?${sp.toString()}`;
  };

  return (
    <div className="container py-[42px]">
      <h1 className="text-3xl font-bold mb-2">找设备</h1>
      <p className="text-muted mb-6">按设备型号、名称或品牌查找矿山设备及相关配件</p>

      <form method="get" action="/equipment" className="bg-white border rounded p-3 mb-3 flex gap-2">
        <input name="q" defaultValue={q} placeholder="搜索设备型号、设备名称、品牌……" className="flex-1 border rounded px-3 py-2 text-sm outline-none" />
        <button className="bg-amber-500 text-white px-4 rounded text-sm font-bold">搜索</button>
      </form>

      <form method="get" action="/equipment" className="bg-white border rounded p-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <input type="hidden" name="q" value={q} />
        <select name="brandId" defaultValue={brandId ?? ""} className="border rounded px-2 py-1.5">
          <option value="">全部品牌</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name} {b.nameEn ? `(${b.nameEn})` : ""}</option>)}
        </select>
        <select name="equipmentType" defaultValue={equipmentType} className="border rounded px-2 py-1.5">
          <option value="">全部类型</option>
          {types.map((t) => <option key={t.equipmentType} value={t.equipmentType}>{t.equipmentType}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="bg-slate-900 text-white px-3 py-1.5 rounded flex-1">应用筛选</button>
          <Link href="/equipment" className="border px-3 py-1.5 rounded">重置</Link>
        </div>
      </form>

      <p className="text-sm text-muted mb-3">共 {total} 个设备</p>

      {equipment.length === 0 ? (
        <div className="bg-white border rounded p-8 text-center">
          <p className="mb-2 font-bold">未找到相关设备</p>
          <p className="text-sm text-muted mb-4">没有找到您需要的设备？您可以提交新增设备申请，由平台管理员审核。</p>
          <Link href="/equipment/request" className="inline-block bg-amber-500 text-white px-5 py-2 rounded font-bold">申请新增设备</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
          {equipment.map((e) => (
            <Link key={e.id} href={`/equipment/${e.slug}`} className="bg-white border rounded-lg overflow-hidden hover:shadow block">
              <div className="h-36 bg-gradient-to-br from-slate-700 to-slate-900 relative">
                {e.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.imageUrl} alt={`${e.brand.name} ${e.model}`} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white text-2xl font-bold">{e.brand.name[0]}</div>
                )}
              </div>
              <div className="p-4">
                <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">{e.brand.name}</span>
                <div className="font-bold mt-2">{e.model}</div>
                <div className="text-xs text-muted">{e.name} · {e.equipmentType}</div>
                <div className="text-xs text-gray-400 mt-1">相关件号 {e._count.partNumbers}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          baseQuery={new URLSearchParams(
            Object.entries({ q, brandId: brandId ? String(brandId) : "", equipmentType }).filter(([, v]) => v) as [string, string][]
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
