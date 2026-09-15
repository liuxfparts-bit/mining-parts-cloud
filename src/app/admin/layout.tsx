import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminShell from "@/components/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "ADMIN") redirect("/dashboard");

  return (
    <AdminShell userName={(session.user as any)?.name}>
      {children}
    </AdminShell>
  );
}
