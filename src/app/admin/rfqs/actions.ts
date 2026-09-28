"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAdminTransitionRfq } from "@/lib/rfq-lifecycle";

async function requireAdmin() {
  const s = await auth();
  if (!s?.user) redirect("/login");
  if ((s.user as any).role !== "ADMIN") throw new Error("forbidden");
}

export async function setRfqStatus(id: number, status: string) {
  await requireAdmin();
  const rfq = await prisma.rFQ.findUnique({ where: { id }, select: { status: true } });
  if (!rfq || !canAdminTransitionRfq(rfq.status, status)) throw new Error("非法询价状态转换");
  await prisma.rFQ.updateMany({ where: { id, status: rfq.status }, data: { status } });
  revalidatePath("/admin/rfqs");
}

export async function deleteRfqs(ids: number[]) {
  await requireAdmin();
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
  await prisma.$transaction(async (tx) => {
    const quoted = await tx.quote.findFirst({ where: { rfqId: { in: uniqueIds } }, select: { rfqId: true } });
    if (quoted) throw new Error("含有供应商报价的询价不能删除");
    await tx.rFQ.deleteMany({ where: { id: { in: uniqueIds } } });
  });
  revalidatePath("/admin/rfqs");
}

/** Atomic batch close: preflight every RFQ before writing any status. */
export async function closeRfqs(ids: number[]) {
  await requireAdmin();
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueIds.length === 0) throw new Error("未选择有效询价");
  await prisma.$transaction(async (tx) => {
    const rfqs = await tx.rFQ.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, status: true } });
    if (rfqs.length !== uniqueIds.length || rfqs.some((rfq) => !canAdminTransitionRfq(rfq.status, "CLOSED"))) {
      throw new Error("所选询价包含不能关闭的状态");
    }
    const updated = await tx.rFQ.updateMany({ where: { id: { in: uniqueIds }, status: { in: ["COLLECTING", "QUOTED", "SELECTED"] } }, data: { status: "CLOSED" } });
    if (updated.count !== uniqueIds.length) throw new Error("询价状态已变化，请刷新后重试");
  });
  revalidatePath("/admin/rfqs");
}
