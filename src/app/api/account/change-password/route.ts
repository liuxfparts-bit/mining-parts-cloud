import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const oldPw = String(body.oldPassword || "");
  const newPw = String(body.newPassword || "");
  if (newPw.length < 8 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(newPw)) {
    return NextResponse.json({ ok: false, message: "新密码至少 8 位，含字母数字" }, { status: 400 });
  }
  const uid = Number(session.user.id);
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user || !user.passwordHash) return NextResponse.json({ ok: false, message: "账号异常" }, { status: 400 });
  const ok = await bcrypt.compare(oldPw, user.passwordHash);
  if (!ok) return NextResponse.json({ ok: false, message: "原密码错误" }, { status: 400 });
  const passwordHash = await bcrypt.hash(newPw, 10);
  await prisma.user.update({ where: { id: uid }, data: { passwordHash } });
  return NextResponse.json({ ok: true });
}
