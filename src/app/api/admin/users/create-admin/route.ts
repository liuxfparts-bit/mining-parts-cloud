import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "无权限" }, { status: 403 });
  }
  const actorUserId = Number((session?.user as any)?.id);
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");

  if (!email || !email.includes("@") || name.length < 2) {
    return NextResponse.json({ ok: false, message: "请填写有效邮箱和管理员姓名" }, { status: 400 });
  }
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ ok: false, message: "密码至少 12 位，并包含大小写字母和数字" }, { status: 400 });
  }

  const exists = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (exists) return NextResponse.json({ ok: false, message: "该邮箱已存在，请使用独立的备用管理员邮箱" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name, passwordHash, role: "ADMIN", status: "ACTIVE", emailVerified: new Date() },
      select: { id: true, email: true },
    });
    await tx.securityAuditLog.create({
      data: {
        actorUserId,
        action: "ADMIN_ACCOUNT_CREATED",
        targetType: "USER",
        targetId: String(user.id),
        summary: "Backup administrator account created.",
      },
    });
    return user;
  });

  return NextResponse.json({ ok: true, userId: created.id, email: created.email });
}
