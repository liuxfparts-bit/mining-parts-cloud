import Link from "next/link";
import { prisma } from "@/lib/db";
import PartNumberCard from "@/components/PartNumberCard";

export const dynamic = "force-dynamic";

export default async function PartNumbersPage() {
  const partNumbers = await prisma.partNumber.findMany({
    include: {
      brand: true,
      equipment: { include: { brand: true } },
      products: { include: { supplier: true } },
    },
    orderBy: { number: "asc" },
  });

  return (
    <div className="container py-[42px]">
      <h1 className="text-3xl font-bold mb-2">件号数据库</h1>
      <p className="text-muted mb-8">按件号查找适配设备和可供货供应商</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
        {partNumbers.map((p) => {
          const prices = p.products.map((pr) => pr.price).filter((v): v is number => v !== null);
          return (
            <PartNumberCard
              key={p.id}
              slug={p.slug}
              partNumber={p.number}
              name={p.name}
              category={p.category}
              brandName={p.brand?.name}
              equipmentModel={p.equipment?.model}
              supplierCount={p.products.length}
              minPrice={prices.length > 0 ? Math.min(...prices) : null}
            />
          );
        })}
      </div>
    </div>
  );
}
