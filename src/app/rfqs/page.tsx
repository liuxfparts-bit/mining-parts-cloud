import Link from "next/link";
import { prisma } from "@/lib/db";
import RFQCard from "@/components/RFQCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RFQListPage() {
  const rfqs = await prisma.rFQ.findMany({
    include: { partNumber: true, _count: { select: { quotes: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="container py-[42px]">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">询价大厅</h1>
          <p className="text-muted">浏览最新采购需求，供应商可直接报价</p>
        </div>
        <Link href="/rfq/create"><Button className="bg-accent text-ink"><Plus className="mr-1 h-4 w-4" />发布询价</Button></Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
        {rfqs.map((r) => (
          <RFQCard
            key={r.id}
            id={r.id}
            title={r.title}
            partNumberStr={r.partNumber?.number || r.partNumberStr}
            brandName={r.brandName}
            quantity={r.quantity}
            region={r.region}
            status={r.status}
            createdAt={r.createdAt}
          />
        ))}
      </div>
    </div>
  );
}
