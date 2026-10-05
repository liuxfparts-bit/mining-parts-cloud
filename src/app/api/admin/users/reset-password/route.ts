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
  const actorUserId = Number((session?.user as any)?.id);
  if (actorUserId === userId) {
    return NextResponse.json({ ok: false, message: "管理员不能从用户管理页重置自己的密码，请使用安全设置修改密码" }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
  if (!target) return NextResponse.json({ ok: false, message: "用户不存在" }, { status: 404 });

  const newPw = crypto.randomBytes(6).toString("base64url") + "A1";
  const passwordHash = await bcrypt.hash(newPw, 10);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.securityAuditLog.create({
      data: {
        actorUserId,
        action: "ADMIN_PASSWORD_RESET",
        targetType: "USER",
        targetId: String(userId),
        summary: "Administrator reset a user password; existing sessions invalidated.",
        metadata: { targetRole: target.role },
      },
    });
  });
  return NextResponse.json({ ok: true, password: newPw, reauthRequired: true });
}
