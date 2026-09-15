import Link from "next/link";
import { prisma } from "@/lib/db";
import RFQCard from "@/components/RFQCard";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/Pagination";
import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "询价大厅｜矿配云",
    description: "矿配云询价大厅，浏览最新矿山设备备件采购需求，找到您可以供应的产品并立即报价。",
  };
}

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "COLLECTING", label: "待报价" },
  { value: "QUOTED", label: "报价中" },
  { value: "SELECTED", label: "已选定" },
  { value: "CLOSED", label: "已关闭" },
  { value: "EXPIRED", label: "已截止" },
];

export default async function RFQListPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const q = (searchParams.q || "").trim();
  const status = searchParams.status || "";
  const pageSize = searchParams.pageSize ? Math.min(100, Math.max(10, parseInt(searchParams.pageSize))) : 20;
  const page = searchParams.page ? Math.max(1, parseInt(searchParams.page)) : 1;

  // ===== 数据库级搜索（标题 / 件号 / 品牌 / 设备 / 采购明细） =====
  const where: any = {};
  const and: any[] = [];
  if (q) {
    and.push({
      OR: [
        { title: { contains: q } },
        { partNumberStr: { contains: q } },
        { brandName: { contains: q } },
        { partNumber: { number: { contains: q } } },
        { items: { some: { partNumber: { contains: q } } } },
        { items: { some: { partName: { contains: q } } } },
        { items: { some: { brand: { contains: q } } } },
        { items: { some: { equipmentModel: { contains: q } } } },
      ],
    });
  }
  if (status) where.status = status;
  if (and.length) where.AND = and;

  // ===== 数据库级 COUNT + 分页 =====
  const [total, rfqs] = await Promise.all([
    prisma.rFQ.count({ where }),
    prisma.rFQ.findMany({
      where,
      include: {
        partNumber: true,
        items: { select: { id: true } },
        _count: { select: { quotes: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const baseQuery = new URLSearchParams(
    Object.entries({ q, status }).filter(([, v]) => v) as [string, string][]
  );

  const selectCls =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40 bg-white";

  return (
    <div className="container py-[42px]">
      {/* 顶部标题 */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">询价大厅</h1>
          <p className="text-muted">浏览最新矿山设备备件采购需求，找到您可以供应的产品</p>
        </div>
        <Link href="/rfq/create" className="shrink-0">
          <Button className="bg-accent text-ink"><Plus className="mr-1 h-4 w-4" />发布询价</Button>
        </Link>
      </div>

      {/* 搜索 + 状态筛选 */}
      <form method="get" action="/rfqs" className="bg-white border border-line rounded-lg p-4 mb-4">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索件号、设备型号、配件名称、品牌……"
            className="flex-1 border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
          />
          <button className="inline-flex items-center gap-1.5 bg-brandGreen text-white px-5 rounded-md text-sm font-medium hover:bg-brandGreen/90 shrink-0">
            <Search className="h-4 w-4" />搜索询价
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-sm">
          <select name="status" defaultValue={status} className={selectCls}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div className="flex gap-2 sm:col-span-2">
            <button className="flex-1 bg-brandGreen text-white px-3 py-2 rounded-md font-medium hover:bg-brandGreen/90">应用筛选</button>
            <Link href="/rfqs" className="flex-1 border border-line px-3 py-2 rounded-md text-center hover:bg-gray-50">重置</Link>
          </div>
        </div>
      </form>

      {/* 数据统计 */}
      <p className="text-sm text-muted mb-4">共 {total} 条采购需求</p>

      {rfqs.length === 0 ? (
        <div className="bg-white border border-line rounded-lg p-10 text-center">
          <p className="mb-3 font-bold text-lg">没有找到符合条件的询价</p>
          <p className="text-sm text-muted mb-4">您可以重置搜索条件，或发布新的采购询价。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/rfqs" className="inline-block border border-line px-5 py-2 rounded-md hover:bg-gray-50">重置搜索</Link>
            <Link href="/rfq/create" className="inline-block bg-brandGreen text-white px-5 py-2 rounded-md font-medium hover:bg-brandGreen/90">发布询价</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
          {rfqs.map((r) => (
            <RFQCard
              key={r.id}
              id={r.id}
              rfqNo={r.rfqNo}
              title={r.title}
              partNumberStr={r.partNumber?.number || r.partNumberStr}
              brandName={r.brandName}
              quantity={r.quantity}
              itemCount={r.items.length}
              quoteCount={r._count.quotes}
              region={r.region}
              status={r.status}
              createdAt={r.createdAt}
            />
          ))}
        </div>
      )}

      {/* 数据库级分页 + 每页条数 */}
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} baseQuery={baseQuery} />
    </div>
  );
}
