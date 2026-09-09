export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SupplierEditClient from "./SupplierEditClient";

export default async function SupplierEdit({ params }: { params: { id: string } }) {
  const s = await prisma.supplier.findUnique({ where: { id: parseInt(params.id) } });
  if (!s) notFound();

  return (
    <div className="p-6 max-w-3xl">
      <a href={`/admin/suppliers/${s.id}`} className="text-sm text-blue-600 hover:underline">← 返回详情</a>
      <h1 className="text-2xl font-bold mt-4 mb-6">编辑企业：{s.name}</h1>
      <SupplierEditClient supplier={s} />
    </div>
  );
}
