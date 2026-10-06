"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSupplierWriteAccess } from "@/lib/supplier-write-access";

async function getMySupplierId() {
  const access = await requireSupplierWriteAccess("BUSINESS");
  return access.supplierId;
}

export async function createProduct(formData: FormData) {
  const supplierId = await getMySupplierId();
  const partNumberId = parseInt(formData.get("partNumberId") as string);
  const name = (formData.get("name") as string).trim();
  const price = parseFloat(formData.get("price") as string) || null;
  await prisma.product.create({
    data: { name, partNumberId, supplierId, price, status: "PENDING", images: (formData.get("imageUrl") as string) || "" },
  });
  revalidatePath("/supplier/products");
  redirect("/supplier/products");
}

