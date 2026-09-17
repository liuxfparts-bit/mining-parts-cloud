export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SupplierShell from "./SupplierShell";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, name: true, email: true, role: true, supplierId: true },
  });
  if (!user) redirect("/login");
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role === "BUYER") redirect("/dashboard");

  const supplier = user.supplierId
    ? await prisma.supplier.findUnique({
        where: { id: user.supplierId },
        select: { name: true, shortName: true, memberLevel: true, verifiedStatus: true },
      })
    : null;

  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <SupplierShell
      user={{ name: user.name, email: user.email }}
      supplier={supplier}
      unreadCount={unread}
    >
      {children}
    </SupplierShell>
  );
}
