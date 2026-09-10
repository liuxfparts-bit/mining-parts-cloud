export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import ProductEditClient from "./ProductEditClient";

export default async function EditProduct({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");

  const product = await prisma.product.findUnique({ where: { id: parseInt(params.id) } });
  if (!product) notFound();
  if (product.supplierId !== user.supplierId) redirect("/supplier/products");

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">编辑产品</h1>
      <ProductEditClient product={{
        id: product.id,
        name: product.name,
        productType: product.productType || "Aftermarket",
        price: product.price ?? "",
        currency: product.currency || "CNY",
        moq: product.moq ?? 1,
        stockStatus: product.stockStatus || "IN_STOCK",
        stock: product.stock ?? "",
        leadTime: product.leadTime || "",
        warranty: product.warranty || "",
        description: product.description || "",
        images: product.images ? product.images.split(",") : [],
        status: product.status,
      }} />
    </div>
  );
}
