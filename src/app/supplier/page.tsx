export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Package,
  FileSearch,
  Send,
  TrendingUp,
  ChevronRight,
  Building2,
  FileDigit,
  SlidersHorizontal,
  Megaphone,
  ArrowRight,
} from "lucide-react";

const MEMBER_CN: Record<string, string> = { FREE: "免费会员", BRONZE: "铜牌会员", SILVER: "银牌会员", GOLD: "金牌会员" };

export default async function SupplierHome() {
  const session = await auth();
  const email = (session?.user as any)?.email;
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user?.supplierId) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center text-sm text-slate-400">
        您还没有绑定供应商企业资料，请联系平台管理员或完善企业资料。
      </div>
    );
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: user.supplierId },
    select: {
      id: true,
      name: true,
      shortName: true,
      memberLevel: true,
      verifiedStatus: true,
      contactName: true,
      mobile: true,
      email: true,
      mainBusiness: true,
      mainBrands: true,
      mainEquipment: true,
      description: true,
    },
  });
  if (!supplier) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center text-sm text-slate-400">
        供应商资料不存在，请联系平台管理员。
      </div>
    );
  }

  // ===== 核心指标（全部数据库实时统计）=====
  const onlineProducts = await prisma.product.count({
    where: { supplierId: supplier.id, status: "PUBLISHED" },
  });

  // 待报价询价：公开征集中的 RFQ 且当前供应商尚未报价
  const pendingRfqCount = await prisma.rFQ.count({
    where: {
      status: "COLLECTING",
      visibility: "PUBLIC",
      quotes: { none: { supplierId: supplier.id } },
    },
  });

  // 询价邀请：采购商定向邀请且未完成报价
  const pendingInvitations = await prisma.rFQInvitation.count({
    where: {
      supplierId: supplier.id,
      status: { in: ["PENDING_VIEW", "VIEWED", "ACCEPTED"] },
    },
  });

  // 本月已报价
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const quotedThisMonth = await prisma.quote.count({
    where: { supplierId: supplier.id, createdAt: { gte: startOfMonth } },
  });

  // 资料完整度
  const fields = [
    supplier.name,
    supplier.contactName,
    supplier.mobile,
    supplier.email,
    supplier.mainBusiness,
    supplier.mainBrands,
    supplier.mainEquipment,
    supplier.description,
  ];
  const profileComplete = Math.round((fields.filter(Boolean).length / fields.length) * 100);

  // ===== 最新询价（含已报价标记）=====
  const recentRfqs = await prisma.rFQ.findMany({
    where: { status: "COLLECTING", visibility: "PUBLIC" },
    include: {
      partNumber: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const recentRfqIds = recentRfqs.map((r) => r.id);
  const quotedRfqIds = new Set(
    (
      await prisma.quote.findMany({
        where: { supplierId: supplier.id, rfqId: { in: recentRfqIds } },
        select: { rfqId: true },
      })
    ).map((q) => q.rfqId),
  );

  // ===== 最新定向邀请 =====
  const latestInvitations = await prisma.rFQInvitation.findMany({
    where: { supplierId: supplier.id },
    include: { rfq: { select: { id: true, title: true, rfqNo: true, expiresAt: true } } },
    orderBy: { invitedAt: "desc" },
    take: 2,
  });

  const memberLevelCn = MEMBER_CN[supplier.memberLevel] || supplier.memberLevel;

  const statCards = [
    {
      label: "在线产品数",
      value: onlineProducts,
      sub: "已上架并对外展示",
      icon: Package,
      iconCls: "bg-blue-50 text-blue-600",
      link: { href: "/supplier/products", text: "管理产品 →" },
    },
    {
      label: "待报价询价",
      value: pendingRfqCount,
      sub: "公开征集中的采购需求",
      icon: FileSearch,
      iconCls: "bg-amber-50 text-amber-600",
      link: { href: "/supplier/rfqs", text: "去报价 →" },
    },
    {
      label: "询价邀请",
      value: pendingInvitations,
      sub: "采购商定向邀请",
      icon: Send,
      iconCls: "bg-green-50 text-green-600",
      highlight: pendingInvitations > 0,
      link: { href: "/supplier/invitations", text: "去处理 →" },
    },
    {
      label: "本月已报价",
      value: quotedThisMonth,
      sub: `资料完整度 ${profileComplete}%`,
      icon: TrendingUp,
      iconCls: "bg-purple-50 text-purple-600",
      link: { href: "/supplier/profile", text: "完善资料 →" },
    },
  ];

  const shortcuts = [
    { href: "/supplier/products", label: "产品管理", desc: "维护在售产品", icon: Package, cls: "bg-blue-50 text-blue-600" },
    { href: "/supplier/invitations", label: "询价邀请", desc: "处理定向邀请", icon: Send, cls: "bg-green-50 text-green-600" },
    { href: "/supplier/rfqs", label: "询价大厅", desc: "浏览采购需求", icon: FileSearch, cls: "bg-amber-50 text-amber-600" },
    { href: "/supplier/part-number-requests/new", label: "件号申请", desc: "申请新件号", icon: FileDigit, cls: "bg-indigo-50 text-indigo-600" },
    { href: "/supplier/profile", label: "接单偏好", desc: "报价通知设置", icon: SlidersHorizontal, cls: "bg-rose-50 text-rose-600" },
  ];

  return (
    <div className="space-y-5">
      {/* ===== 顶部欢迎条 ===== */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-800">供应商工作台</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {supplier.name}
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-slate-600">{memberLevelCn}</span>
            {supplier.verifiedStatus === "VERIFIED" && (
              <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                已认证
              </span>
            )}
            {supplier.contactName && <span className="ml-2 text-slate-400">联系人：{supplier.contactName}</span>}
          </p>
        </div>
        <Link
          href="/supplier/profile"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 shrink-0"
        >
          <Building2 className="w-4 h-4" /> 企业资料与认证 <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ===== 4 列核心指标卡 ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`bg-white rounded-xl border shadow-sm p-5 ${
                c.highlight ? "border-green-300 ring-1 ring-green-100" : "border-slate-200/80"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.iconCls}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {c.highlight && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 animate-pulse">
                    待处理
                  </span>
                )}
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-800">{c.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{c.sub}</div>
              <Link href={c.link.href} className="inline-block text-xs text-blue-600 hover:text-blue-700 mt-2">
                {c.link.text}
              </Link>
            </div>
          );
        })}
      </div>

      {/* ===== 双栏：左 65% 最新询价 + 右 35% 快捷/推荐 ===== */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* 左：最新询价列表 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
            <Megaphone className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-sm text-slate-700">最新询价（采购需求）</h2>
            <span className="ml-auto text-xs text-slate-400">共 {pendingRfqCount} 条待报价</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">询价标题</th>
                  <th className="text-left px-4 py-2.5">品牌 / 设备</th>
                  <th className="text-left px-4 py-2.5">件号</th>
                  <th className="text-left px-4 py-2.5">数量</th>
                  <th className="text-left px-4 py-2.5">截止时间</th>
                  <th className="text-left px-4 py-2.5">操作</th>
                </tr>
              </thead>
              <tbody>
                {recentRfqs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                      暂无公开征集的询价需求
                    </td>
                  </tr>
                ) : (
                  recentRfqs.map((r) => {
                    const quoted = quotedRfqIds.has(r.id);
                    return (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 max-w-[180px] truncate">{r.title}</div>
                          {r.rfqNo && <div className="text-[11px] font-mono text-slate-400 mt-0.5">{r.rfqNo}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {[r.brandName, r.equipmentModel].filter(Boolean).join(" · ") || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {r.partNumberStr || r.partNumber?.number || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                          {r._count.items > 0 ? `${r._count.items} 项明细` : `${r.quantity} ${r.unit}`}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString("zh-CN") : "长期有效"}
                        </td>
                        <td className="px-4 py-3">
                          {quoted ? (
                            <span className="text-[11px] px-2 py-1 rounded bg-slate-100 text-slate-400">已报价</span>
                          ) : (
                            <Link
                              href={`/supplier/rfqs/${r.id}`}
                              className="inline-block bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 whitespace-nowrap"
                            >
                              进行报价 →
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 text-right">
            <Link href="/supplier/rfqs" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
              查看全部询价需求（进入询价大厅） <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 右：快捷入口 + 最新邀请 */}
        <div className="space-y-4">
          {/* 高频快捷入口 */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
            <h2 className="font-semibold text-sm text-slate-700 mb-3">高频快捷入口</h2>
            <div className="grid grid-cols-2 gap-3">
              {shortcuts.map((s) => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.label}
                    href={s.href}
                    className="flex flex-col items-start gap-1.5 rounded-lg border border-slate-200/80 p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.cls}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-medium text-slate-700">{s.label}</span>
                    <span className="text-[11px] text-slate-400">{s.desc}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 智能推荐 / 最新邀请 */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Send className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-sm text-slate-700">最新询价邀请</h2>
            </div>
            {latestInvitations.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                暂无定向邀请，采购商会在询价详情中向您发出邀请
              </p>
            ) : (
              <div className="space-y-3">
                {latestInvitations.map((inv) => (
                  <Link
                    key={inv.id}
                    href="/supplier/invitations"
                    className="block rounded-lg border border-slate-200/80 p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                  >
                    <div className="text-sm font-medium text-slate-700 truncate">{inv.rfq?.title}</div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <span className="font-mono">{inv.rfq?.rfqNo || `#${inv.rfqId}`}</span>
                      {inv.rfq?.expiresAt && (
                        <span>截止 {new Date(inv.rfq.expiresAt).toLocaleDateString("zh-CN")}</span>
                      )}
                    </div>
                    <div className="text-[11px] mt-1.5 text-blue-600">去响应 →</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
