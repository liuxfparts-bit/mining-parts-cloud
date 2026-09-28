"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acceptQuoteForBuyer } from "@/lib/quote-selection";
import { revalidatePath } from "next/cache";

export async function acceptQuote(rfqId: number, quoteId: number) {
  const session = await auth();
  if (!session?.user) throw new Error("请先登录");
  const user = await prisma.user.findUnique({ where: { email: String((session.user as any).email).toLowerCase() }, select: { id: true } });
  if (!user) throw new Error("登录已失效");
  await acceptQuoteForBuyer(rfqId, quoteId, user.id);
  revalidatePath(`/dashboard/quotes/${quoteId}`);
  revalidatePath(`/dashboard/rfqs/${rfqId}`);
  revalidatePath("/dashboard/quotes");
}
