import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "无权限" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const userId = Number(body.userId);
  if (!userId) return NextResponse.json({ ok: false, message: "参数错误" }, { status: 400 });

  const newPw = crypto.randomBytes(6).toString("base64url") + "A1";
  const passwordHash = await bcrypt.hash(newPw, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return NextResponse.json({ ok: true, password: newPw });
}
