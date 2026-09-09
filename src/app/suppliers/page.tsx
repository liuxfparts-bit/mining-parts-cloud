import { prisma } from "@/lib/db";
import SupplierCard from "@/components/SupplierCard";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { id: "asc" },
  });

  return (
    <div className="container py-[42px]">
      <h1 className="text-3xl font-bold mb-2">找厂家</h1>
      <p className="text-muted mb-8">认证矿山设备与配件供应商</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
        {suppliers.map((s) => (
          <SupplierCard key={s.id} slug={s.slug} name={s.name} shortName={s.shortName} province={s.province} mainBusiness={s.mainBusiness} verified={s.verifiedStatus === "VERIFIED"} productCount={s._count.products} memberLevel={s.memberLevel} />
        ))}
      </div>
    </div>
  );
}
