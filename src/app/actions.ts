"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function createRFQ(prevState: { error?: string; success?: boolean }, formData: FormData) {
  const title = String(formData.get("title") || "");
  const brandName = String(formData.get("brandName") || "");
  const equipmentModel = String(formData.get("equipmentModel") || "");
  const productName = String(formData.get("productName") || "");
  const partNumber = String(formData.get("partNumber") || "");
  const quantity = String(formData.get("quantity") || "1");
  const unit = String(formData.get("unit") || "pcs");
  const description = String(formData.get("description") || "");
  const deliveryDateStr = String(formData.get("deliveryDate") || "");
  const deliveryLocation = String(formData.get("deliveryLocation") || "");
  const incoterm = String(formData.get("incoterm") || "");
  const contactName = String(formData.get("contactName") || "");
  const contactPhone = String(formData.get("contactPhone") || "");
  const contactEmail = String(formData.get("contactEmail") || "");
  const whatsapp = String(formData.get("whatsapp") || "");

  if (!title || !description || !contactName || !contactPhone) {
    return { error: "请填写所有必填字段" };
  }

  try {
    // 尝试匹配件号
    let partNumberId: number | null = null;
    let matchedSupplierIds: number[] = [];
    if (partNumber) {
      const pn = await prisma.partNumber.findUnique({
        where: { number: partNumber.toUpperCase() },
        include: { products: { include: { supplier: true } } },
      });
      if (pn) {
        partNumberId = pn.id;
        // 自动匹配：件号 → Product → Supplier
        matchedSupplierIds = Array.from(new Set(pn.products.map((p) => p.supplierId)));
      }
    }

    await prisma.rFQ.create({
      data: {
        title,
        brandName: brandName || null,
        equipmentModel: equipmentModel || null,
        productName: productName || null,
        partNumberStr: partNumber || null,
        partNumberId,
        quantity: parseInt(quantity) || 1,
        unit,
        description,
        deliveryDate: deliveryDateStr ? new Date(deliveryDateStr) : null,
        deliveryLocation: deliveryLocation || null,
        incoterm: incoterm || null,
        contactName,
        contactPhone,
        contactEmail: contactEmail || null,
        whatsapp: whatsapp || null,
        matchedSuppliers: matchedSupplierIds.length > 0 ? JSON.stringify(matchedSupplierIds) : null,
      },
    });
  } catch (e) {
    console.error("createRFQ error:", e);
    return { error: "提交失败，请重试" };
  }

  revalidatePath("/rfq");
  redirect("/rfq?created=1");
}
