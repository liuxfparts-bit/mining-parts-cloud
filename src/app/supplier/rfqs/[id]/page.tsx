export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { canSupplierAccessRfq } from "@/lib/rfq-supplier-access";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import QuoteForm, { type QuoteItemT, type ExistingQuoteT } from "@/components/QuoteForm";
import RfqImages from "@/components/RfqImages";
import { FileText } from "lucide-react";

const STATUS_CN: Record<string, { label: string; cls: string }> = {
  COLLECTING: { label: "征集中", cls: "bg-blue-50 text-blue-700" },
  QUOTED: { label: "已报价", cls: "bg-green-50 text-green-700" },
  SELECTED: { label: "已选定", cls: "bg-green-50 text-green-700" },
  CLOSED: { label: "已关闭", cls: "bg-gray-100 text-gray-600" },
  EXPIRED: { label: "已过期", cls: "bg-red-50 text-red-600" },
};

/** 解析 RFQ/RFQItem 的 images JSON（容错：无效返回空数组） */
function parseImageList(v: string | null): string[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && x) : [];
  } catch {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export default async function SupplierQuotePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { inv?: string };
}) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "SUPPLIER") notFound();
  const user = await prisma.user.findUnique({
    where: { email: String((session.user as any).email).toLowerCase() },
    select: { id: true, supplierId: true },
  });
  if (!user?.supplierId) redirect("/supplier");
  const supplierId = user.supplierId;

  const rfq = await prisma.rFQ.findUnique({
    where: { id },
    include: {
      partNumber: true,
      items: { include: { partNumber: true }, orderBy: { seq: "asc" } },
      quotes: { where: { supplierId }, include: { items: true } },
    },
  });
  if (!rfq) notFound();

  if (!canSupplierAccessRfq(rfq, supplierId)) notFound();

  const closed = rfq.status === "CLOSED" || rfq.status === "EXPIRED";
  const existing = (rfq.quotes[0] || null) as ExistingQuoteT;
  const items = rfq.items as QuoteItemT[];
  const st = STATUS_CN[rfq.status] || { label: rfq.status, cls: "bg-gray-100 text-gray-600" };

  // 邀请 token 校验（属于本 RFQ 且绑定本供应商或待绑定）
  let invitationToken: string | undefined;
  if (searchParams.inv) {
    const inv = await prisma.rFQInvitation.findUnique({
      where: { token: searchParams.inv },
      select: { rfqId: true, supplierId: true },
    });
    if (inv && inv.rfqId === id && (inv.supplierId === null || inv.supplierId === supplierId)) {
      invitationToken = searchParams.inv;
    }
  }

  const rfqImages = parseImageList(rfq.images);
  const itemImages = rfq.items
    .map((it) => ({ seq: it.seq, urls: parseImageList(it.images ?? null) }))
    .filter((x) => x.urls.length > 0);
  const attachments = parseImageList(rfq.attachments);

  return (
    <div className="space-y-4">
      {/* 返回 + 标题 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/supplier/rfqs" className="text-sm text-slate-500 hover:text-blue-600">← 返回待处理询价</Link>
          <h1 className="text-xl font-bold mt-1 flex items-center gap-2 flex-wrap">
            提交报价
            <span className={`inline-block text-xs px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            {rfq.rfqNo || `#${rfq.id}`} · {rfq.title}
          </p>
        </div>
      </div>

      {/* ===== 询价基本信息 ===== */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <h2 className="font-semibold text-sm text-slate-700 mb-3">询价基本信息</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-400 block">采购商</span>
            <span className="text-slate-700">{rfq.contactName || "—"}</span>
            {rfq.contactPhone && <span className="text-xs text-slate-400 block mt-0.5">{rfq.contactPhone}</span>}
          </div>
          <div>
            <span className="text-xs text-slate-400 block">发布时间</span>
            <span className="text-slate-700">{new Date(rfq.createdAt).toLocaleString("zh-CN")}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">报价截止</span>
            <span className="text-slate-700">
              {rfq.expiresAt ? new Date(rfq.expiresAt).toLocaleString("zh-CN") : "长期有效"}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">采购明细</span>
            <span className="text-slate-700">{items.length} 项</span>
            {existing && existing.quotedCount > 0 && (
              <span className="text-xs text-amber-600 block mt-0.5">已报价 {existing.quotedCount}/{items.length} 项</span>
            )}
          </div>
          {rfq.deliveryLocation && (
            <div>
              <span className="text-xs text-slate-400 block">交货地点</span>
              <span className="text-slate-700">{rfq.deliveryLocation}</span>
            </div>
          )}
          {rfq.incoterm && (
            <div>
              <span className="text-xs text-slate-400 block">贸易条款</span>
              <span className="text-slate-700">{rfq.incoterm}</span>
            </div>
          )}
          {rfq.deliveryDate && (
            <div>
              <span className="text-xs text-slate-400 block">期望交期</span>
              <span className="text-slate-700">{new Date(rfq.deliveryDate).toLocaleDateString("zh-CN")}</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== 询价图片 / 图纸 / 附件 ===== */}
      {(rfqImages.length > 0 || itemImages.length > 0 || attachments.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <h2 className="font-semibold text-sm text-slate-700 mb-3">询价图片 / 图纸 / 附件</h2>
          {rfqImages.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-slate-400 mb-1.5">询价图片</div>
              <RfqImages urls={rfqImages} />
            </div>
          )}
          {itemImages.map((g) => (
            <div key={g.seq} className="mb-3">
              <div className="text-xs text-slate-400 mb-1.5">Item {g.seq} 图片 / 图纸</div>
              <RfqImages urls={g.urls} size="sm" />
            </div>
          ))}
          {attachments.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-1.5">附件</div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((u) => (
                  <a
                    key={u}
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 border rounded px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100"
                  >
                    <FileText className="w-3 h-3 text-slate-400" />
                    <span className="max-w-[180px] truncate text-blue-600">{u.split("/").pop()}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== 报价表单（含完整采购明细，逐项填写报价） ===== */}
      {closed ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-8 text-center text-sm text-slate-400">
          该询价已关闭（{rfq.status}），无法继续报价。
        </div>
      ) : (
        <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">加载报价表单…</div>}>
          <QuoteForm
            rfqId={rfq.id}
            supplierId={supplierId}
            items={items}
            existing={existing}
            invitationToken={invitationToken}
            successRedirect="/supplier/quotes"
          />
        </Suspense>
      )}
    </div>
  );
}
