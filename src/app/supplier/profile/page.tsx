export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SupplierProfileClient from "./SupplierProfileClient";

export default async function SupplierProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");
  const supplier = await prisma.supplier.findUnique({ where: { id: user.supplierId } });
  if (!supplier) redirect("/supplier");

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">企业资料</h1>
      <SupplierProfileClient supplier={supplier} />
    </div>
  );
}
