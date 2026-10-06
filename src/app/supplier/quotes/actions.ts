"use server";

import { withdrawQuoteForSupplier } from "@/lib/quote-selection";
import { revalidatePath } from "next/cache";
import { requireSupplierWriteAccess } from "@/lib/supplier-write-access";

export async function withdrawMyQuote(quoteId: number) {
  const access = await requireSupplierWriteAccess("BUSINESS");
  await withdrawQuoteForSupplier(quoteId, access.supplierId);
  revalidatePath(`/supplier/quotes/${quoteId}`);
  revalidatePath("/supplier/quotes");
}
