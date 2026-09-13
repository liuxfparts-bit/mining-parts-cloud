"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const s = await auth();
  if (!s?.user) redirect("/login");
  if ((s.user as any).role !== "ADMIN") throw new Error("forbidden");
}

export async function setRfqStatus(id: number, status: string) {
  await requireAdmin();
  if (!["COLLECTING", "CLOSED", "REJECTED"].includes(status)) throw new Error("bad status");
  await prisma.rFQ.update({ where: { id }, data: { status } });
  revalidatePath("/admin/rfqs");
}

export async function deleteRfqs(ids: number[]) {
  await requireAdmin();
  await prisma.rFQ.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/admin/rfqs");
}
