import Link from "next/link";
import { prisma } from "@/lib/db";
import Pagination from "@/components/Pagination";
import EquipmentCard from "@/components/EquipmentCard";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import { PUBLIC_PRODUCT_WHERE_NESTED } from "@/lib/public-product";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "找设备｜矿配云",
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
      include: {
        brand: true,
        // V3.1: Part Number Source of Truth = PartNumberEquipment（非 legacy equipmentId）
        // 过滤 publishStatus=READY；@@unique([partNumberId, equipmentModelId]) 保证 relation count == distinct PN
        partNumberRelations: {
          where: { partNumber: { publishStatus: "READY" } },
          select: {
            equipmentModelId: true,
            partNumber: {
              select: {
                products: {
                  where: PUBLIC_PRODUCT_WHERE_NESTED,
                  select: { supplierId: true },
                },
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, nameEn: true } }),
    prisma.equipment.findMany({ where: { status: "ACTIVE" }, distinct: ["equipmentType"], select: { equipmentType: true }, orderBy: { equipmentType: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const baseQuery = new URLSearchParams(
    Object.entries({ q, brandId: brandId ? String(brandId) : "", equipmentType }).filter(([, v]) => v) as [string, string][]
  );

  const inputCls =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40 bg-white";

  return (
    <div className="container py-[42px]">
      {/* 顶部标题 */}
      <h1 className="text-3xl font-bold mb-2">找设备</h1>
      <p className="text-muted mb-6">快速查找地下采矿设备、型号及对应备件</p>

      {/* 搜索区 */}
      <form method="get" action="/equipment" className="bg-white border border-line rounded-lg p-4 mb-4">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索设备品牌、型号，例如：JOY 14CM15、Sandvik LS190、CAT CL210"
            className="flex-1 border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
          />
          <button className="inline-flex items-center gap-1.5 bg-brandGreen text-white px-5 rounded-md text-sm font-medium hover:bg-brandGreen/90 shrink-0">
            <Search className="h-4 w-4" />搜索
          </button>
        </div>
        {/* 品牌筛选 */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
          <span className="text-muted text-xs">品牌：</span>
          {(() => {
            const sp = new URLSearchParams();
            if (q) sp.set("q", q);
            if (equipmentType) sp.set("equipmentType", equipmentType);
            return (
              <>
                <Link href={`/equipment?${sp.toString()}`} className={`px-3 py-1 rounded-full border ${!brandId ? "bg-brandGreen text-white border-brandGreen" : "border-line hover:bg-gray-50"}`}>全部</Link>
                {brands.map((b) => {
                  const s2 = new URLSearchParams(sp.toString());
                  s2.set("brandId", String(b.id));
                  s2.set("page", "1");
                  return (
                    <Link key={b.id} href={`/equipment?${s2.toString()}`} className={`px-3 py-1 rounded-full border ${brandId === b.id ? "bg-brandGreen text-white border-brandGreen" : "border-line hover:bg-gray-50"}`}>
                      {b.name}
                    </Link>
                  );
                })}
              </>
            );
          })()}
        </div>
        {/* 类型筛选 */}
        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
          <span className="text-muted text-xs">类型：</span>
          {(() => {
            const sp = new URLSearchParams();
            if (q) sp.set("q", q);
            if (brandId) sp.set("brandId", String(brandId));
            return (
              <>
                <Link href={`/equipment?${sp.toString()}`} className={`px-3 py-1 rounded-full border ${!equipmentType ? "bg-brandGreen text-white border-brandGreen" : "border-line hover:bg-gray-50"}`}>全部</Link>
                {types.map((t) => {
                  const s2 = new URLSearchParams(sp.toString());
                  s2.set("equipmentType", t.equipmentType);
                  s2.set("page", "1");
                  return (
                    <Link key={t.equipmentType} href={`/equipment?${s2.toString()}`} className={`px-3 py-1 rounded-full border ${equipmentType === t.equipmentType ? "bg-brandGreen text-white border-brandGreen" : "border-line hover:bg-gray-50"}`}>
                      {t.equipmentType}
                    </Link>
                  );
                })}
              </>
            );
          })()}
        </div>
      </form>

      {/* 数据统计 */}
      <p className="text-sm text-muted mb-4">共 {total} 个设备</p>

      {equipment.length === 0 ? (
        <div className="bg-white border border-line rounded-lg p-10 text-center">
          <p className="mb-2 font-bold text-lg">未找到相关设备</p>
          <p className="text-sm text-muted mb-4">没有找到您需要的设备？您可以提交新增设备申请，由平台管理员审核。</p>
          <Link href="/equipment/request" className="inline-block bg-brandGreen text-white px-5 py-2 rounded-md font-medium hover:bg-brandGreen/90">申请新增设备</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
          {equipment.map((e) => {
            // partCount = relation rows（@@unique 保证 == distinct READY PartNumber）
            const partCount = e.partNumberRelations.length;
            // supplierCount = distinct supplierId across READY PN → PUBLISHED Product → verified supplier
            const supplierCount = new Set(e.partNumberRelations.flatMap((r) => r.partNumber.products.map((p) => p.supplierId))).size;
            return (
              <EquipmentCard
                key={e.id}
                slug={e.slug}
                brandName={e.brand.name}
                model={e.model}
                equipmentType={e.equipmentType}
                description={e.name}
                partCount={partCount}
                supplierCount={supplierCount}
                imageUrl={e.imageUrl}
              />
            );
          })}
        </div>
      )}

      {/* 分页 + 每页条数 */}
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} baseQuery={baseQuery} />
    </div>
  );
}
