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

export async function createQuote(formData: FormData) {
  const supplierId = await getMySupplierId();
  const rfqId = parseInt(formData.get("rfqId") as string);
  const unitPrice = parseFloat(formData.get("unitPrice") as string) || 0;
  const currency = (formData.get("currency") as string) || "USD";
  const leadTime = (formData.get("leadTime") as string) || null;
  const warranty = (formData.get("warranty") as string) || null;
  const remarks = (formData.get("remarks") as string) || null;
  await prisma.quote.create({
    data: { rfqId, supplierId, unitPrice, currency, leadTime, warranty, remarks, status: "SUBMITTED" },
  });
  revalidatePath("/supplier/quotes");
  redirect("/supplier/quotes");
}

export async function createRfq(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email as string } });
  if (!user) redirect("/login");
  if (!user) redirect("/login");
  const title = (formData.get("title") as string).trim();
  const partNumberId = parseInt(formData.get("partNumberId") as string) || null;
  const quantity = parseFloat(formData.get("quantity") as string) || 1;
  const unit = (formData.get("unit") as string) || "pcs";
  const description = (formData.get("description") as string) || "";
  const deliveryLocation = (formData.get("deliveryLocation") as string) || "";
  await prisma.rFQ.create({
    data: {
      title,
      partNumberId,
      quantity,
      unit,
      description: (description as string) || "",
      deliveryLocation: deliveryLocation as string || "",
      status: "COLLECTING",
      userID: user.id,
      contactName: (formData.get("contactName") as string) || "",
      contactPhone: (formData.get("contactPhone") as string) || "",
      productName: title,
      purchaseType: "NORMAL",
      visibility: "PUBLIC",
    },
  });
  revalidatePath("/supplier/rfqs");
  redirect("/supplier/rfqs");
}
