import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await auth();
  const u = await prisma.user.findUnique({ where: { email: (s?.user as any)?.email } });
  if (!u || u.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = parseInt(params.id);
  const { logo } = await req.json();
  if (!logo || typeof logo !== "string") return NextResponse.json({ error: "bad logo" }, { status: 400 });
  await prisma.brand.update({ where: { id }, data: { logo } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const s = await auth();
  const u = await prisma.user.findUnique({ where: { email: (s?.user as any)?.email } });
  if (!u || u.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await prisma.brand.update({ where: { id: parseInt(params.id) }, data: { logo: null } });
  return NextResponse.json({ ok: true });
}
