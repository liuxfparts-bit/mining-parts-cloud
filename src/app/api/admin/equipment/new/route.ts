import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const fd = await req.formData();
  const v = (k: string) => (fd.get(k) as string)?.trim() || null;
  const model = (fd.get("model") as string).trim();
  const name = (fd.get("name") as string).trim();
  const brandId = parseInt(fd.get("brandId") as string);
  const inputSlug = (fd.get("slug") as string)?.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const slug = inputSlug || model.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  await prisma.equipment.create({
    data: {
      model, name, brandId,
      nameEn: v("nameEn"), series: v("series"),
      equipmentType: (fd.get("equipmentType") as string) || "通用",
      application: v("application"), mineType: v("mineType"), manufacturer: v("manufacturer"),
      description: v("description"), imageUrl: v("imageUrl"),
      slug: slug || "eq-" + Date.now(),
      status: "ACTIVE",
    },
  });
  return NextResponse.json({ ok: true });
}
