export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import NewEquipmentForm from "./NewEquipmentForm";

export default async function NewEquipmentPage() {
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">新增设备</h1>
      <NewEquipmentForm brands={brands.map((b) => ({ id: b.id, name: b.name, nameEn: b.nameEn }))} />
    </div>
  );
}
