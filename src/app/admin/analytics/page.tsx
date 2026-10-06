import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function beijingDayStart(now = new Date()) {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 60 * 60 * 1000);
}

export default async function AnalyticsDashboard() {
  const now = new Date();
  const today = beijingDayStart(now);
  const sevenDays = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [
    pvToday,
    visitorsToday,
    sessionsToday,
    searchesToday,
    zeroSearchesToday,
    rfqsToday,
    quotesToday,
    sourceGroups,
    topPages,
    topSearches,
    supplierLegacy,
    pnLegacy,
    bannerTotals,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: { eventType: "PAGE_VIEW", createdAt: { gte: today } } }),
    prisma.analyticsEvent.findMany({ where: { eventType: "PAGE_VIEW", createdAt: { gte: today }, visitorId: { not: null } }, distinct: ["visitorId"], select: { visitorId: true } }),
    prisma.analyticsSession.count({ where: { startedAt: { gte: today } } }),
    prisma.analyticsEvent.count({ where: { eventType: "SEARCH", createdAt: { gte: today } } }),
    prisma.analyticsEvent.count({ where: { eventType: "SEARCH", resultCount: 0, createdAt: { gte: today } } }),
    prisma.rFQ.count({ where: { createdAt: { gte: today } } }),
    prisma.quote.count({ where: { createdAt: { gte: today } } }),
    prisma.analyticsSession.groupBy({ by: ["source", "medium"], where: { startedAt: { gte: sevenDays } }, _count: { _all: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
    prisma.analyticsEvent.groupBy({ by: ["path"], where: { eventType: "PAGE_VIEW", createdAt: { gte: sevenDays } }, _count: { _all: true }, orderBy: { _count: { path: "desc" } }, take: 10 }),
    prisma.analyticsEvent.groupBy({ by: ["searchQuery"], where: { eventType: "SEARCH", createdAt: { gte: sevenDays }, searchQuery: { not: null } }, _count: { _all: true }, orderBy: { _count: { searchQuery: "desc" } }, take: 10 }),
    prisma.supplier.aggregate({ _count: { _all: true }, _sum: { viewCount: true, inquiryCount: true } }),
    prisma.partNumber.aggregate({ _sum: { viewCount: true, inquiryCount: true } }),
    prisma.banner.aggregate({ _sum: { impressions: true, clicks: true } }),
  ]);

  const attributedRfqSessions = await prisma.analyticsEvent.findMany({
    where: { eventType: "RFQ_CREATE", createdAt: { gte: today }, sessionId: { not: null } },
    distinct: ["sessionId"],
    select: { sessionId: true },
  });
  const conversion = sessionsToday > 0 ? ((attributedRfqSessions.length / sessionsToday) * 100).toFixed(1) : "0.0";

  const cards = [
    ["今日 PV", pvToday, "公开页面浏览事件"],
    ["今日 UV", visitorsToday.length, "匿名 visitor 去重"],
    ["今日会话", sessionsToday, "30 分钟会话"],
    ["今日搜索", searchesToday, `零结果 ${zeroSearchesToday}`],
    ["今日 RFQ", rfqsToday, "RFQ 业务表为真相源"],
    ["今日报价", quotesToday, "Quote 业务表为真相源"],
    ["RFQ 转化率", `${conversion}%`, "可归因会话 → RFQ"],
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">行为分析与经营驾驶舱</h1>
        <p className="text-sm text-gray-500 mt-1">北京时间口径。行为指标自 WP0-5 上线后开始累计，不回填历史访问。</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(([label, value, sub]) => (
          <div key={String(label)} className="bg-white border rounded-lg p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            <div className="text-xs text-gray-400 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-8">
        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-bold mb-3">近 7 天入口来源</h2>
          <div className="space-y-2 text-sm">
            {sourceGroups.length === 0 ? <p className="text-gray-400">上线后暂无数据</p> : sourceGroups.map((x) => (
              <div key={`${x.source}/${x.medium}`} className="flex justify-between gap-3">
                <span className="truncate">{x.source} <span className="text-gray-400">/ {x.medium}</span></span>
                <b>{x._count._all}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-bold mb-3">近 7 天热门页面</h2>
          <div className="space-y-2 text-sm">
            {topPages.length === 0 ? <p className="text-gray-400">上线后暂无数据</p> : topPages.map((x) => (
              <div key={x.path} className="flex justify-between gap-3"><span className="truncate font-mono text-xs">{x.path}</span><b>{x._count._all}</b></div>
            ))}
          </div>
        </section>

        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-bold mb-3">近 7 天搜索词</h2>
          <div className="space-y-2 text-sm">
            {topSearches.length === 0 ? <p className="text-gray-400">上线后暂无数据</p> : topSearches.map((x) => (
              <div key={x.searchQuery || "-"} className="flex justify-between gap-3"><span className="truncate">{x.searchQuery || "-"}</span><b>{x._count._all}</b></div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h2 className="font-bold text-amber-900">数据质量说明</h2>
        <div className="text-sm text-amber-900/80 mt-2 space-y-1">
          <p>• Supplier 旧缓存字段当前合计：viewCount={supplierLegacy._sum.viewCount || 0}，inquiryCount={supplierLegacy._sum.inquiryCount || 0}。这些历史值不进入本驾驶舱。</p>
          <p>• PartNumber 旧缓存字段当前合计：viewCount={pnLegacy._sum.viewCount || 0}，inquiryCount={pnLegacy._sum.inquiryCount || 0}。这些字段不是行为分析真相源。</p>
          <p>• Banner 旧计数：impressions={bannerTotals._sum.impressions || 0}，clicks={bannerTotals._sum.clicks || 0}；保留为 Banner 自身统计，不等同于平台 PV/UV。</p>
          <p>• RFQ、报价数量始终来自业务表；AnalyticsEvent 只负责来源与转化路径，不反向修改业务事实。</p>
        </div>
      </section>
    </div>
  );
}
