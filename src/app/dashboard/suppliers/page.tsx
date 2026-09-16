export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCompanyUserIds } from "@/lib/buyer-company";
import Pagination from "@/components/Pagination";
import { Handshake, Phone, Mail, Eye } from "lucide-react";

const PAGE_SIZES = [10, 20, 50];

export default async function BuyerSuppliers({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string; pageSize?: string };
}) {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, buyerCompanyId: true },
  });
  if (!user) redirect("/login");

  // 企业共享：本人 + 同企业成员发布的 RFQ 收到的报价 → 聚合出合作供应商
  const companyUserIds = await getCompanyUserIds(user.id);
  const companyId = user.buyerCompanyId ?? -1;
  const rfqs = await prisma.rFQ.findMany({
    where: { OR: [{ userID: { in: companyUserIds } }, { companyID: companyId }] },
    select: { id: true },
  });
  const rfqIds = rfqs.map((r) => r.id);

  const q = (searchParams.q || "").trim();
  const statusFilter = searchParams.status || "ALL";
  const pageSize = PAGE_SIZES.includes(parseInt(searchParams.pageSize || "10"))
    ? parseInt(searchParams.pageSize || "10")
    : 10;
  const page = Math.max(1, parseInt(searchParams.page || "1") || 1);

  // 合作供应商 = 对本企业 RFQ 提交过报价的供应商（数据库聚合：按供应商分组统计）
  const quoteWhere: any = {
    rfqId: { in: rfqIds },
    ...(q && {
      supplier: {
        OR: [{ name: { contains: q } }, { mainBrands: { contains: q } }, { mainBusiness: { contains: q } }],
      },
    }),
  };

  const grouped = await prisma.quote.groupBy({
    by: ["supplierId"],
    where: quoteWhere,
    _count: { _all: true },
    _max: { createdAt: true },
  });

  // 活跃报价（待处理/已接受）统计，用于"合作中/历史合作"状态
  const activeGrouped = await prisma.quote.groupBy({
    by: ["supplierId"],
    where: { ...quoteWhere, status: { in: ["PENDING", "ACCEPTED"] } },
    _count: { _all: true },
  });
  const activeMap = new Map(activeGrouped.map((g) => [g.supplierId, g._count._all]));

  const suppliersWithMeta = grouped
    .filter((g) => g.supplierId != null)
    .map((g) => ({
      supplierId: g.supplierId as number,
      count: g._count._all,
      lastAt: g._max.createdAt,
      activeCount: activeMap.get(g.supplierId as number) || 0,
    }))
    .filter((s) => (statusFilter === "ALL" ? true : statusFilter === "ACTIVE" ? s.activeCount > 0 : s.activeCount === 0))
    .sort((a, b) => (b.lastAt?.getTime() || 0) - (a.lastAt?.getTime() || 0));

  const total = suppliersWithMeta.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSuppliers = suppliersWithMeta.slice((page - 1) * pageSize, page * pageSize);

  const supplierIds = pageSuppliers.map((s) => s.supplierId);
  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: supplierIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      contactName: true,
      mobile: true,
      telephone: true,
      email: true,
      mainBrands: true,
      mainEquipment: true,
      mainBusiness: true,
      verifiedStatus: true,
      memberLevel: true,
    },
  });
  const supplierMap = new Map(suppliers.map((sp) => [sp.id, sp]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">合作供应商</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            共 <span className="font-semibold text-slate-700">{total}</span> 家供应商对本企业询价提交过报价
          </p>
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索供应商 / 品牌 / 主营"
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <select name="status" defaultValue={statusFilter} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white">
            <option value="ALL">全部合作</option>
            <option value="ACTIVE">合作中</option>
            <option value="HISTORY">历史合作</option>
          </select>
          <button className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm hover:bg-blue-700">搜索</button>
          <Link href="/dashboard/suppliers" className="text-sm text-slate-500 px-2 hover:text-slate-700">
            重置
          </Link>
        </form>
      </div>

      {suppliersWithMeta.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center text-sm text-slate-400">
          <Handshake className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          暂无合作供应商
          <div className="mt-2">
            <Link href="/rfq/create" className="text-blue-600 font-medium">
              发布询价，供应商报价后自动建立合作关系 →
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 桌面卡片网格 */}
          <div className="hidden md:grid lg:grid-cols-2 gap-4">
            {pageSuppliers.map((pm) => {
              const sp = supplierMap.get(pm.supplierId);
              if (!sp) return null;
              return (
                <div key={pm.supplierId} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/suppliers/${sp.slug}`} className="font-semibold text-slate-800 hover:text-blue-600">
                        {sp.name}
                      </Link>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {sp.mainBrands && `品牌：${sp.mainBrands}`}
                        {sp.mainEquipment && ` · 设备：${sp.mainEquipment}`}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[11px] px-2 py-0.5 rounded ${
                        pm.activeCount > 0 ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {pm.activeCount > 0 ? "合作中" : "历史合作"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg py-2">
                      <div className="text-base font-bold text-slate-800">{pm.count}</div>
                      <div className="text-[10px] text-slate-400">报价次数</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-2">
                      <div className="text-base font-bold text-slate-800">{pm.activeCount}</div>
                      <div className="text-[10px] text-slate-400">进行中</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-2">
                      <div className="text-xs font-medium text-slate-700 mt-1">
                        {pm.lastAt ? new Date(pm.lastAt).toLocaleDateString("zh-CN") : "-"}
                      </div>
                      <div className="text-[10px] text-slate-400">最近合作</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    {sp.contactName && <span>联系人：{sp.contactName}</span>}
                    {(sp.mobile || sp.telephone) && <span>{sp.mobile || sp.telephone}</span>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/suppliers/${sp.slug}`}
                      className="flex-1 text-center text-xs border border-blue-200 text-blue-600 rounded-lg py-1.5 hover:bg-blue-50 inline-flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> 查看
                    </Link>
                    {sp.mobile && (
                      <a
                        href={`tel:${sp.mobile}`}
                        className="flex-1 text-center text-xs border border-slate-200 text-slate-600 rounded-lg py-1.5 hover:bg-slate-50 inline-flex items-center justify-center gap-1"
                      >
                        <Phone className="w-3 h-3" /> 联系
                      </a>
                    )}
                    {sp.email && (
                      <a
                        href={`mailto:${sp.email}`}
                        className="flex-1 text-center text-xs border border-slate-200 text-slate-600 rounded-lg py-1.5 hover:bg-slate-50 inline-flex items-center justify-center gap-1"
                      >
                        <Mail className="w-3 h-3" /> 邮件
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 手机卡片 */}
          <div className="md:hidden space-y-3">
            {pageSuppliers.map((pm) => {
              const sp = supplierMap.get(pm.supplierId);
              if (!sp) return null;
              return (
                <div key={pm.supplierId} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/suppliers/${sp.slug}`} className="font-semibold text-slate-800 text-sm">
                        {sp.name}
                      </Link>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        报价 {pm.count} 次 · 最近 {pm.lastAt ? new Date(pm.lastAt).toLocaleDateString("zh-CN") : "-"}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[11px] px-2 py-0.5 rounded ${
                        pm.activeCount > 0 ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {pm.activeCount > 0 ? "合作中" : "历史"}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/suppliers/${sp.slug}`}
                      className="flex-1 text-center text-xs bg-blue-600 text-white rounded-lg py-2"
                    >
                      查看
                    </Link>
                    {sp.mobile && (
                      <a href={`tel:${sp.mobile}`} className="flex-1 text-center text-xs border border-slate-200 rounded-lg py-2">
                        联系
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 分页（数据库级，统一组件） */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        pageSizes={PAGE_SIZES}
        label="家"
        makeHref={(p, ps) => {
          const sp = new URLSearchParams();
          if (q) sp.set("q", q);
          if (statusFilter !== "ALL") sp.set("status", statusFilter);
          sp.set("page", String(p));
          sp.set("pageSize", String(ps));
          return `/dashboard/suppliers?${sp.toString()}`;
        }}
      />
    </div>
  );
}
