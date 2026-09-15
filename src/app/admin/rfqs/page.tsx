export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { RowActions } from "./RowActions";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  COLLECTING: { label: "征集中", cls: "bg-green-100 text-green-700" },
  CLOSED: { label: "已关闭", cls: "bg-gray-100 text-gray-600" },
  REJECTED: { label: "已驳回", cls: "bg-red-100 text-red-700" },
  QUOTED: { label: "已报价", cls: "bg-blue-100 text-blue-700" },
  SELECTED: { label: "已选定", cls: "bg-blue-100 text-blue-700" },
};

const TYPE_LABEL: Record<string, string> = {
  STOCK: "现货",
  NORMAL: "常规",
  URGENT: "紧急",
  LONG_TERM: "长期",
  PROJECT: "项目",
};

export default async function AdminRfqsPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string; q?: string; status?: string; type?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page || "1") || 1);
  const pageSize = [10, 20, 50, 100].includes(parseInt(searchParams.pageSize || "10"))
    ? parseInt(searchParams.pageSize || "10")
    : 10;
  const q = (searchParams.q || "").trim();
  const status = searchParams.status || "";
  const type = searchParams.type || "";

  const where: any = {};
  if (status) where.status = status;
  if (type) where.purchaseType = type;
  if (q) {
    where.OR = [
      { rfqNo: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { partNumberStr: { contains: q, mode: "insensitive" } },
      { productName: { contains: q, mode: "insensitive" } },
      { contactName: { contains: q, mode: "insensitive" } },
      { brandName: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, items, stats] = await Promise.all([
    prisma.rFQ.count({ where }),
    prisma.rFQ.findMany({
      where,
      include: {
        partNumber: true,
        items: { select: { id: true } },
        quotes: { select: { id: true, quotedCount: true, totalAmount: true, currency: true, supplier: { select: { name: true, shortName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    Promise.all([
      prisma.rFQ.count(),
      prisma.rFQ.count({ where: { status: "COLLECTING" } }),
      prisma.rFQ.count({ where: { status: "QUOTED" } }),
      prisma.rFQ.count({ where: { status: "CLOSED" } }),
      prisma.rFQ.count({ where: { status: "REJECTED" } }),
    ]),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [cntAll, cntOpen, cntQuoted, cntClosed, cntRejected] = stats;

  function buildUrl(p: number, extra?: Record<string, string>) {
    const sp = new URLSearchParams();
    sp.set("page", String(p));
    sp.set("pageSize", String(pageSize));
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (type) sp.set("type", type);
    if (extra) Object.entries(extra).forEach(([k, v]) => sp.set(k, v));
    return `/admin/rfqs?${sp.toString()}`;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">询价管理</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { label: "全部", n: cntAll, href: buildUrl(1, { status: "" }) },
          { label: "征集中", n: cntOpen, href: buildUrl(1, { status: "COLLECTING" }) },
          { label: "已报价", n: cntQuoted, href: buildUrl(1, { status: "QUOTED" }) },
          { label: "已关闭", n: cntClosed, href: buildUrl(1, { status: "CLOSED" }) },
          { label: "已驳回", n: cntRejected, href: buildUrl(1, { status: "REJECTED" }) },
        ].map((c) => (
          <a key={c.label} href={c.href} className="bg-white border rounded p-4 hover:border-accent">
            <div className="text-2xl font-bold">{c.n}</div>
            <div className="text-xs text-muted">{c.label}</div>
          </a>
        ))}
      </div>

      {/* 搜索 */}
      <form className="bg-white border rounded p-3 mb-3 flex gap-2 items-center flex-wrap">
        <input name="q" defaultValue={q} placeholder="RFQ编号 / 标题 / 件号 / 产品名 / 采购方 / 品牌"
          className="flex-1 min-w-[200px] h-9 px-3 border rounded text-sm" />
        <select name="status" defaultValue={status} className="h-9 border rounded px-2 text-sm">
          <option value="">全部状态</option>
          <option value="COLLECTING">征集中</option>
          <option value="QUOTED">已报价</option>
          <option value="SELECTED">已选定</option>
          <option value="CLOSED">已关闭</option>
          <option value="REJECTED">已驳回</option>
        </select>
        <select name="type" defaultValue={type} className="h-9 border rounded px-2 text-sm">
          <option value="">全部类型</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="pageSize" defaultValue={pageSize} className="h-9 border rounded px-2 text-sm">
          {[10, 20, 50, 100].map((s) => <option key={s} value={s}>{s} 条/页</option>)}
        </select>
        <button className="h-9 px-4 bg-dark text-white rounded text-sm">搜索</button>
        <a href="/admin/rfqs" className="h-9 px-4 border rounded text-sm flex items-center">重置</a>
      </form>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 w-8">#</th>
              <th className="text-left p-3">RFQ编号</th>
              <th className="text-left p-3">采购标题</th>
              <th className="text-left p-3">采购方</th>
              <th className="text-left p-3 text-center">Item数</th>
              <th className="text-left p-3 text-center">报价供应商</th>
              <th className="text-left p-3">报价完成度</th>
              <th className="text-left p-3">类型</th>
              <th className="text-left p-3">状态</th>
              <th className="text-left p-3">创建时间</th>
              <th className="text-left p-3">截止时间</th>
              <th className="text-left p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const st = STATUS_LABEL[r.status] || { label: r.status, cls: "bg-gray-100" };
              const itemCount = r.items.length;
              const quotedItems = r.quotes.reduce((s, q) => s + (q.quotedCount || 0), 0);
              const pct = itemCount > 0 ? Math.round((quotedItems / itemCount) * 100) : 0;
              return (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="p-3"><input type="checkbox" className="row-cb" data-id={r.id} /></td>
                  <td className="p-3 font-mono text-xs">{r.rfqNo || `#${r.id}`}</td>
                  <td className="p-3">
                    <a href={`/admin/rfqs/${r.id}`} className="text-blue-600 hover:underline">{r.title}</a>
                  </td>
                  <td className="p-3 text-xs">{r.contactName}{r.contactPhone ? `（${r.contactPhone}）` : ""}</td>
                  <td className="p-3 text-center">{itemCount}</td>
                  <td className="p-3 text-center">{r.quotes.length} 家</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded overflow-hidden">
                        <div className="h-full bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted">{quotedItems}/{itemCount} 项</span>
                    </div>
                  </td>
                  <td className="p-3 text-xs">{TYPE_LABEL[r.purchaseType] || r.purchaseType}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${st.cls}`}>{st.label}</span></td>
                  <td className="p-3 text-xs whitespace-nowrap">{r.createdAt.toLocaleString("zh-CN")}</td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {r.expiresAt ? new Date(r.expiresAt).toLocaleString("zh-CN") : "—"}
                  </td>
                  <td className="p-3"><RowActions id={r.id} status={r.status} /></td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={12} className="p-8 text-center text-muted">无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div className="flex justify-between items-center mt-4 text-sm">
        <span>共 {total} 条，第 {page} / {totalPages} 页</span>
        <div className="flex gap-1">
          {page > 1 && <a href={buildUrl(page - 1)} className="px-3 py-1 border rounded">上一页</a>}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p = i + 1;
            if (totalPages > 5) p = Math.min(totalPages - 4, Math.max(1, page - 2)) + i;
            return <a key={p} href={buildUrl(p)}
              className={`px-3 py-1 border rounded ${p === page ? "bg-dark text-white" : ""}`}>{p}</a>;
          })}
          {page < totalPages && <a href={buildUrl(page + 1)} className="px-3 py-1 border rounded">下一页</a>}
        </div>
      </div>
    </div>
  );
}
