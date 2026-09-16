"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function markNotificationsRead() {
  const session = await auth();
  const email = (session?.user as any)?.email;
  if (!email) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user) redirect("/login");

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}
