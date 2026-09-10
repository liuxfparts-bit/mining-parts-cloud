export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NewProductClient from "./NewProductClient";

const MAX_IMG: Record<string, number> = { FREE: 1, BRONZE: 2, SILVER: 3, GOLD: 4 };

export default async function NewProduct() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
  const supplier = user?.supplierId ? await prisma.supplier.findUnique({ where: { id: user.supplierId } }) : null;
  if (!supplier) redirect("/supplier");

  const partNumbers = await prisma.partNumber.findMany({ orderBy: { number: "asc" }, take: 500 });
  const maxImages = MAX_IMG[supplier.memberLevel] || 1;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">新增产品</h1>
      <NewProductClient partNumbers={partNumbers} maxImages={maxImages} memberLevel={supplier.memberLevel} />
    </div>
  );
}
