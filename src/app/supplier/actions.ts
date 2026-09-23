"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function getMySupplierId() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");
  return user.supplierId;
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

