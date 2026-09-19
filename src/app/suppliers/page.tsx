import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SupplierCard from "@/components/SupplierCard";
import SupplierFilter from "@/components/SupplierFilter";
import Pagination from "@/components/Pagination";
import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/public-product";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "找厂家｜矿配云",
    description: "矿配云认证矿山设备及备件制造商、供应商和专业服务商名录，支持按厂家名称、品牌、配件名称和件号搜索。",
  };
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

function parsePage(value: string | undefined): number {
  const n = parseInt(value || "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parsePageSize(value: string | undefined): number {
  const n = parseInt(value || "20", 10);
  return PAGE_SIZE_OPTIONS.includes(n) ? n : 20;
}

type SearchParams = {
  page?: string;
  pageSize?: string;
  name?: string;
  brand?: string;
  part?: string;
  partNumber?: string;
};

export default async function SuppliersPage({ searchParams }: { searchParams: SearchParams }) {
  const page = parsePage(searchParams.page);
  const pageSize = parsePageSize(searchParams.pageSize);
  const name = (searchParams.name || "").trim();
  const brand = (searchParams.brand || "").trim();
  const part = (searchParams.part || "").trim();
  const partNumber = (searchParams.partNumber || "").trim();

  // ===== 数据库级 WHERE 构造（品牌/配件名称/件号通过产品关系跨表匹配） =====
  const conditions: Prisma.SupplierWhereInput[] = [];

  // 厂家名称模糊匹配
  if (name) {
    conditions.push({ OR: [{ name: { contains: name } }, { shortName: { contains: name } }] });
  }
  // 品牌：厂家存在公开产品且其标准件号关联品牌匹配
  if (brand) {
    conditions.push({
      products: { some: { AND: [PUBLIC_PRODUCT_WHERE, { partNumber: { brand: { name: { contains: brand } } } }] } },
    });
  }
  // 配件名称：厂家存在公开产品且件号名称匹配
  if (part) {
    conditions.push({
      products: { some: { AND: [PUBLIC_PRODUCT_WHERE, { partNumber: { name: { contains: part } } }] } },
    });
  }
  // 件号：标准件号或供应商自定义 OEM 件号匹配
  if (partNumber) {
    conditions.push({
      products: {
        some: {
          AND: [
            PUBLIC_PRODUCT_WHERE,
            {
              OR: [
                { partNumber: { number: { contains: partNumber } } },
                { oemNumber: { contains: partNumber } },
              ],
            },
          ],
        },
      },
    });
  }

  const where: Prisma.SupplierWhereInput = {
    verifiedStatus: "VERIFIED",
    users: { none: { status: "DISABLED" } },
    AND: conditions,
  };

  // ===== 数据库级 COUNT（去重后的厂家总数） =====
  const total = await prisma.supplier.count({ where });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  // ===== 数据库级分页：只取当前页数据 =====
  const suppliers = await prisma.supplier.findMany({
    where,
    include: { _count: { select: { products: true } } },
    orderBy: [{ id: "asc" }],
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  const baseQuery = new URLSearchParams(
    Object.entries({ name, brand, part, partNumber }).filter(([, v]) => v) as [string, string][]
  );

  return (
    <div className="container py-[42px]">
      {/* 顶部标题 */}
      <h1 className="text-3xl font-bold mb-2">找厂家</h1>
      <p className="text-muted mb-6">寻找矿山设备及备件制造商、供应商和专业服务商</p>

      <SupplierFilter initial={{ name, brand, part, partNumber }} />

      {/* 数据统计 */}
      <p className="text-sm text-muted mb-4">共 {total} 家厂家</p>

      {suppliers.length === 0 ? (
        <div className="bg-white border border-line rounded-lg p-10 text-center">
          <p className="mb-3 font-bold text-lg">没有找到符合条件的厂家</p>
          <p className="text-sm text-muted mb-4">请调整搜索条件后重试。</p>
          <Link
            href="/suppliers"
            className="inline-block border border-line text-sm px-5 py-2 rounded-md hover:bg-gray-50"
          >
            重置搜索
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
          {suppliers.map((s) => (
            <SupplierCard
              key={s.id}
              slug={s.slug}
              name={s.name}
              shortName={s.shortName}
              province={s.province}
              mainBusiness={s.mainBusiness}
              mainBrands={s.mainBrands}
              mainEquipment={s.mainEquipment}
              verified={s.verifiedStatus === "VERIFIED"}
              productCount={s._count.products}
              memberLevel={s.memberLevel}
            />
          ))}
        </div>
      )}

      {/* 数据库级分页 + 每页条数 */}
      <Pagination page={currentPage} totalPages={totalPages} total={total} pageSize={pageSize} baseQuery={baseQuery} />
    </div>
  );
}
