export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RequestForm from "./RequestForm";

async function submit(formData: FormData) {
  "use server";
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (s.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");

  const pn = (formData.get("partNumber") as string).toUpperCase().trim();
  const exists = await prisma.partNumber.findUnique({ where: { number: pn } });
  if (exists) redirect("/supplier/part-number-requests?err=exists");
  const pending = await prisma.partNumberRequest.findFirst({ where: { partNumber: pn, status: "PENDING" } });
  if (pending) redirect("/supplier/part-number-requests?err=pending");

  await prisma.partNumberRequest.create({
    data: {
      supplierId: user.supplierId,
      partNumber: pn,
      partName: formData.get("partName") as string,
      brandName: (formData.get("brandName") as string) || null,
      equipmentModel: (formData.get("equipmentModel") as string) || null,
      categoryId: formData.get("categoryId") ? parseInt(formData.get("categoryId") as string) : null,
      description: (formData.get("description") as string) || null,
    },
  });
  redirect("/supplier/part-number-requests");
}

export default async function NewRequest({ searchParams }: { searchParams: { partNumber?: string } }) {
  const s = await auth();
  if (!s) redirect("/login");
  const parents = await prisma.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" }, include: { children: { orderBy: { sortOrder: "asc" } } } });
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">申请新增件号</h1>
      <RequestForm parents={parents} defaultPartNumber={searchParams.partNumber || ""} submitAction={submit} />
    </div>
  );
}
