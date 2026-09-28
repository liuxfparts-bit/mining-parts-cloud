"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withdrawQuoteForSupplier } from "@/lib/quote-selection";
import { revalidatePath } from "next/cache";

export async function withdrawMyQuote(quoteId: number) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "SUPPLIER") throw new Error("无权撤回报价");
  const user = await prisma.user.findUnique({ where: { email: String((session.user as any).email).toLowerCase() }, select: { supplierId: true } });
  if (!user?.supplierId) throw new Error("账号未绑定供应商资料");
  await withdrawQuoteForSupplier(quoteId, user.supplierId);
  revalidatePath(`/supplier/quotes/${quoteId}`);
  revalidatePath("/supplier/quotes");
}
