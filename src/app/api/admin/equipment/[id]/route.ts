import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = parseInt(params.id);
  const fd = await req.formData();
  const v = (k: string) => (fd.get(k) as string)?.trim() || null;
  await prisma.equipment.update({
    where: { id },
    data: {
      brandId: parseInt(fd.get("brandId") as string),
      model: (fd.get("model") as string).trim(),
      name: (fd.get("name") as string).trim(),
      nameEn: v("nameEn"), series: v("series"),
      equipmentType: (fd.get("equipmentType") as string) || "通用",
      application: v("application"), mineType: v("mineType"), manufacturer: v("manufacturer"),
      description: v("description"), imageUrl: v("imageUrl"),
    },
  });
  return NextResponse.json({ ok: true });
}
