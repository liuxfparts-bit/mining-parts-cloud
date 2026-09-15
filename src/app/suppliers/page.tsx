import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SupplierCard from "@/components/SupplierCard";
import SupplierFilter from "@/components/SupplierFilter";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

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

function buildHref(params: {
  page: number;
  pageSize: number;
  name: string;
  brand: string;
  part: string;
  partNumber: string;
}): string {
  const p = new URLSearchParams();
  if (params.name) p.set("name", params.name);
  if (params.brand) p.set("brand", params.brand);
  if (params.part) p.set("part", params.part);
  if (params.partNumber) p.set("partNumber", params.partNumber);
  p.set("page", String(params.page));
  if (params.pageSize !== 20) p.set("pageSize", String(params.pageSize));
  return `/suppliers?${p.toString()}`;
}

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
  // 品牌：厂家存在 ACTIVE 产品且其标准件号关联品牌匹配
  if (brand) {
    conditions.push({
      products: { some: { status: "ACTIVE", partNumber: { brand: { name: { contains: brand } } } } },
    });
  }
  // 配件名称：厂家存在 ACTIVE 产品且件号名称匹配
  if (part) {
    conditions.push({
      products: { some: { status: "ACTIVE", partNumber: { name: { contains: part } } } },
    });
  }
  // 件号：标准件号或供应商自定义 OEM 件号匹配
  if (partNumber) {
    conditions.push({
      products: {
        some: {
          status: "ACTIVE",
          OR: [
            { partNumber: { number: { contains: partNumber } } },
            { oemNumber: { contains: partNumber } },
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

  // 分页页码（最多显示 7 个，含省略号）
  const pageItems: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageItems.push(i);
  } else {
    pageItems.push(1);
    if (currentPage > 3) pageItems.push("…");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pageItems.push(i);
    if (currentPage < totalPages - 2) pageItems.push("…");
    pageItems.push(totalPages);
  }

  return (
    <div className="container py-[42px]">
      <h1 className="text-3xl font-bold mb-2">找厂家</h1>
      <p className="text-muted mb-6">认证矿山设备与配件供应商 · 共 {total} 家厂家</p>

      <SupplierFilter initial={{ name, brand, part, partNumber }} />

      {suppliers.length === 0 ? (
        <div className="bg-white border border-line rounded-lg p-10 text-center">
          <p className="text-muted mb-4">没有找到符合条件的厂家</p>
          <Link
            href="/suppliers"
            className="inline-block border border-line text-sm px-5 py-2 rounded-md hover:bg-gray-50"
          >
            重置搜索
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-muted">第 {currentPage} / {totalPages} 页 · 共 {total} 家厂家</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted mr-1">每页</span>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <Link
                  key={size}
                  href={buildHref({ page: 1, pageSize: size, name, brand, part, partNumber })}
                  className={`px-2 py-1 rounded ${size === pageSize ? "bg-brandGreen text-white" : "border border-line hover:bg-gray-50"}`}
                >
                  {size}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
            {suppliers.map((s) => (
              <SupplierCard
                key={s.id}
                slug={s.slug}
                name={s.name}
                shortName={s.shortName}
                province={s.province}
                mainBusiness={s.mainBusiness}
                verified={s.verifiedStatus === "VERIFIED"}
                productCount={s._count.products}
                memberLevel={s.memberLevel}
              />
            ))}
          </div>

          {/* 分页：翻页保留搜索条件 */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
            <p className="text-xs text-muted">
              第 {currentPage} / {totalPages} 页 · 共 {total} 家厂家
            </p>
            <nav className="flex items-center gap-1 flex-wrap justify-center">
              {currentPage > 1 && (
                <Link
                  href={buildHref({ page: currentPage - 1, pageSize, name, brand, part, partNumber })}
                  className="px-3 py-1.5 text-sm border border-line rounded-md hover:bg-gray-50 min-w-[36px] text-center"
                >
                  上一页
                </Link>
              )}
              {pageItems.map((it, idx) =>
                it === "…" ? (
                  <span key={`e${idx}`} className="px-2 text-muted text-sm">…</span>
                ) : (
                  <Link
                    key={it}
                    href={buildHref({ page: it, pageSize, name, brand, part, partNumber })}
                    className={`px-3 py-1.5 text-sm rounded-md min-w-[36px] text-center ${
                      it === currentPage
                        ? "bg-brandGreen text-white font-medium"
                        : "border border-line hover:bg-gray-50"
                    }`}
                  >
                    {it}
                  </Link>
                )
              )}
              {currentPage < totalPages && (
                <Link
                  href={buildHref({ page: currentPage + 1, pageSize, name, brand, part, partNumber })}
                  className="px-3 py-1.5 text-sm border border-line rounded-md hover:bg-gray-50 min-w-[36px] text-center"
                >
                  下一页
                </Link>
              )}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
