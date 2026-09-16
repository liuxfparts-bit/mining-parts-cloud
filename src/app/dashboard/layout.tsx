export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isOwner: true,
      position: true,
      buyerCompanyId: true,
    },
  });
  if (!user) redirect("/login");
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role === "SUPPLIER") redirect("/supplier");

  const company = user.buyerCompanyId
    ? await prisma.buyerCompany.findUnique({
        where: { id: user.buyerCompanyId },
        select: {
          id: true,
          companyName: true,
          verifiedStatus: true,
          rejectionReason: true,
          level: true,
        },
      })
    : null;

  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email, role: user.role, isOwner: user.isOwner, position: user.position }}
      company={
        company
          ? {
              companyName: company.companyName,
              verifiedStatus: company.verifiedStatus,
              rejectionReason: company.rejectionReason,
              level: company.level,
            }
          : null
      }
      unreadCount={unread}
    >
      {children}
    </DashboardShell>
  );
}
