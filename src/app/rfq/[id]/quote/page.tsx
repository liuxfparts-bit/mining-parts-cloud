import { Suspense } from "react";
import QuoteForm from "@/components/QuoteForm";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const rfq = await prisma.rFQ.findUnique({
    where: { id },
    include: { partNumber: true },
  });
  if (!rfq) notFound();

  // MVP: 默认用第一个供应商（后续接登录后取当前用户供应商）
  const firstSupplier = await prisma.supplier.findFirst();
  if (!firstSupplier) notFound();

  return (
    <div className="container py-[42px]">
      <div className="max-w-[700px] mx-auto">
        <h1 className="text-3xl font-bold mb-2">提交报价</h1>
        <p className="text-muted mb-6">询价单 #{rfq.id}: {rfq.title}</p>

        {/* RFQ 摘要 */}
        <div className="bg-white border border-line rounded-lg p-5 mb-6 text-sm">
          <div className="flex gap-2 flex-wrap mb-2">
            {rfq.partNumber && <Badge className="font-mono">{rfq.partNumber.number}</Badge>}
            {rfq.brandName && <Badge variant="secondary">{rfq.brandName}</Badge>}
            {rfq.equipmentModel && <Badge variant="outline">{rfq.equipmentModel}</Badge>}
          </div>
          <p className="text-muted">
            数量: <b>{rfq.quantity} {rfq.unit}</b>
            {rfq.deliveryLocation && <> · 交货地: {rfq.deliveryLocation}</>}
            {rfq.incoterm && <> · {rfq.incoterm}</>}
          </p>
          <p className="text-muted mt-1">{rfq.description}</p>
        </div>

        <Suspense>
          <QuoteForm rfqId={rfq.id} supplierId={firstSupplier.id} />
        </Suspense>
      </div>
    </div>
  );
}
