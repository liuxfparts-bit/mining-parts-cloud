import Link from "next/link";
import { prisma } from "@/lib/db";
import { PUBLIC_PRODUCT_WHERE_NESTED } from "@/lib/public-product";
import { normalizePartNumber, PUBLIC_PN_WHERE } from "@/lib/part-number";
import Pagination from "@/components/Pagination";
import PartNumberCard from "@/components/PartNumberCard";
import { Search } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "找件号｜矿配云",
    description: "矿配云矿山设备配件件号数据库，支持按件号、品牌、设备型号和配件分类查询矿山设备配件信息及供应商。",
  };
}

export default async function PartNumbersPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const q = (searchParams.q || "").trim();
  const normalizedQ = normalizePartNumber(q);
  const brandId = searchParams.brandId ? parseInt(searchParams.brandId) : null;
  const equipmentId = searchParams.equipmentId ? parseInt(searchParams.equipmentId) : null;
  const categoryId = searchParams.categoryId ? parseInt(searchParams.categoryId) : null;
  const pageSize = searchParams.pageSize ? Math.min(100, Math.max(10, parseInt(searchParams.pageSize))) : 20;
  const page = searchParams.page ? Math.max(1, parseInt(searchParams.page)) : 1;

  // P2-1B-1: 公开件号统一执行 VERIFIED + READY 门槛。
  const where: any = { ...PUBLIC_PN_WHERE };
  const and: any[] = [];

  if (q) {
    and.push({
      OR: [
        { number: { contains: q } },
        ...(normalizedQ ? [{ normalizedPartNumber: { contains: normalizedQ } }] : []),
        { name: { contains: q } },
        { nameEn: { contains: q } },
        { brand: { name: { contains: q } } },
        { brand: { nameEn: { contains: q } } },
        { equipmentRelations: { some: { equipmentModel: { model: { contains: q } } } } },
        { equipmentRelations: { some: { equipmentModel: { name: { contains: q } } } } },
      ],
    });
  }
  if (brandId) and.push({ brandId });
  if (equipmentId) and.push({ equipmentRelations: { some: { equipmentModelId: equipmentId } } });
  if (categoryId) and.push({ categoryId });
  if (and.length) where.AND = and;

  const [total, partNumbers, brands, equipments, categories] = await Promise.all([
    prisma.partNumber.count({ where }),
    prisma.partNumber.findMany({
      where,
      include: {
        brand: true,
        equipmentRelations: { include: { equipmentModel: { include: { brand: true } } } },
        products: { where: PUBLIC_PRODUCT_WHERE_NESTED, include: { supplier: true } },
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

  const baseQuery = new URLSearchParams(
    Object.entries({
      q,
      brandId: brandId ? String(brandId) : "",
      equipmentId: equipmentId ? String(equipmentId) : "",
      categoryId: categoryId ? String(categoryId) : "",
    }).filter(([, v]) => v) as [string, string][]
  );

  const selectCls =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40 bg-white";

  return (
    <div className="container py-[42px]">
      <h1 className="text-3xl font-bold mb-2">找件号</h1>
      <p className="text-muted mb-6">按品牌、设备型号、配件名称或 Part Number 快速查找矿山备件</p>

      <form method="get" action="/part-number" className="bg-white border border-line rounded-lg p-4 mb-4">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="请输入件号、配件名称、设备型号，例如：100256099、A2U900-511074、Hydraulic Pump、LS190"
            className="flex-1 border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
          />
          <button className="inline-flex items-center gap-1.5 bg-brandGreen text-white px-5 rounded-md text-sm font-medium hover:bg-brandGreen/90 shrink-0">
            <Search className="h-4 w-4" />搜索
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3 text-sm">
          <select name="brandId" defaultValue={brandId ?? ""} className={selectCls}>
            <option value="">全部品牌</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name} {b.nameEn ? `(${b.nameEn})` : ""}</option>)}
          </select>
          <select name="equipmentId" defaultValue={equipmentId ?? ""} className={selectCls}>
            <option value="">全部设备</option>
            {equipments.map((e) => <option key={e.id} value={e.id}>{e.model} {e.name ? `· ${e.name}` : ""}</option>)}
          </select>
          <select name="categoryId" defaultValue={categoryId ?? ""} className={selectCls}>
            <option value="">全部分类</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button className="flex-1 bg-brandGreen text-white px-3 py-2 rounded-md font-medium hover:bg-brandGreen/90">应用筛选</button>
            <Link href="/part-number" className="flex-1 border border-line px-3 py-2 rounded-md text-center hover:bg-gray-50">重置</Link>
          </div>
        </div>
      </form>

      <p className="text-sm text-muted mb-4">共 {total} 个相关件号</p>

      {partNumbers.length === 0 ? (
        <div className="bg-white border border-line rounded-lg p-10 text-center">
          <p className="mb-3 font-bold text-lg">未找到匹配件号</p>
          <p className="text-sm text-muted mb-4">没有找到您需要的配件？您可以提交新件号申请。</p>
          <Link href="/part-number/request" className="inline-block bg-brandGreen text-white px-5 py-2 rounded-md font-medium hover:bg-brandGreen/90">提交新件号申请</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
          {partNumbers.map((p) => {
            const publishedSuppliers = new Set(p.products.map((pr) => pr.supplierId)).size;
            const prices = p.products.map((pr) => pr.price).filter((v): v is number => v !== null);
            return (
              <PartNumberCard
                key={p.id}
                slug={p.slug}
                partNumber={p.number}
                name={p.name}
                category={p.category}
                brandName={p.brand?.name}
                equipmentModel={p.equipmentRelations.map((r) => r.equipmentModel.model).join(" / ") || undefined}
                supplierCount={publishedSuppliers}
                minPrice={prices.length > 0 ? Math.min(...prices) : null}
              />
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} baseQuery={baseQuery} />
    </div>
  );
}
