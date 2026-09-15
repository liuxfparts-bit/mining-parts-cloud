import { Suspense } from "react";
import QuoteForm from "@/components/QuoteForm";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const s = await auth();
  if (!s?.user) redirect(`/login?redirect=/rfq/${id}/quote`);
  const role = (s.user as any).role;
  if (role !== "SUPPLIER") {
    return (
      <div className="container py-[42px]">
        <div className="max-w-[500px] mx-auto bg-white border border-line rounded-lg p-8 text-center">
          <p className="text-lg font-bold mb-2">仅供应商可提交报价</p>
          <p className="text-sm text-muted">请使用供应商账号登录后再报价。</p>
        </div>
      </div>
    );
  }

  const uid = parseInt(String((s.user as any).id));
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, supplierId: true, supplier: { select: { id: true, name: true, shortName: true } } },
  });
  if (!user || !user.supplierId || !user.supplier) {
    return (
      <div className="container py-[42px]">
        <div className="max-w-[500px] mx-auto bg-white border border-line rounded-lg p-8 text-center">
          <p className="text-lg font-bold mb-2">尚未关联供应商档案</p>
          <p className="text-sm text-muted">您的账号未绑定供应商资料，请联系管理员完善后再报价。</p>
        </div>
      </div>
    );
  }

  const rfq = await prisma.rFQ.findUnique({
    where: { id },
    include: {
      partNumber: true,
      items: { include: { partNumber: true }, orderBy: { seq: "asc" } },
      quotes: {
        where: { supplierId: user.supplierId },
        include: { items: true },
      },
    },
  });
  if (!rfq) notFound();

  // 校验该 RFQ 是否允许报价（供应商可见性）
  if (rfq.status === "CLOSED" || rfq.status === "EXPIRED") {
    return (
      <div className="container py-[42px]">
        <div className="max-w-[500px] mx-auto bg-white border border-line rounded-lg p-8 text-center">
          <p className="text-lg font-bold mb-2">该询价已关闭</p>
          <p className="text-sm text-muted">当前状态：{rfq.status}，无法继续报价。</p>
        </div>
      </div>
    );
  }

  const existing = rfq.quotes[0] || null;

  return (
    <div className="container py-[42px]">
      <div className="max-w-[900px] mx-auto">
        <h1 className="text-3xl font-bold mb-2">提交报价</h1>
        <p className="text-muted mb-6">
          询价单 {rfq.rfqNo ? `#${rfq.rfqNo}` : `#${rfq.id}`}: {rfq.title}
          {existing ? "（修改已有报价）" : ""}
        </p>

        {/* RFQ 摘要 */}
        <div className="bg-white border border-line rounded-lg p-5 mb-6 text-sm">
          <div className="flex gap-2 flex-wrap mb-2">
            {rfq.rfqNo && <Badge className="font-mono">{rfq.rfqNo}</Badge>}
            {rfq.items.length > 0 && <Badge variant="secondary">共 {rfq.items.length} 项</Badge>}
            {rfq.deliveryLocation && <Badge variant="outline">交货地: {rfq.deliveryLocation}</Badge>}
            {rfq.incoterm && <Badge variant="outline">{rfq.incoterm}</Badge>}
          </div>
          <p className="text-muted">
            供应商：<b>{user.supplier.shortName || user.supplier.name}</b>
            {existing && <> · 已报价 {existing.quotedCount}/{rfq.items.length} 项</>}
          </p>
        </div>

        <Suspense>
          <QuoteForm rfqId={rfq.id} supplierId={user.supplierId} items={rfq.items} existing={existing} />
        </Suspense>
      </div>
    </div>
  );
}
