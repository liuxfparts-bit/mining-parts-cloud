import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";

const UNIFIED_MSG = "如果该邮箱对应一个矿配云账号，我们会向该邮箱发送密码重置链接。请检查您的收件箱和垃圾邮件。";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (!rateLimit(`fp:ip:${ip}`, 5, 15 * 60 * 1000).allowed) {
    return NextResponse.json({ ok: true, message: UNIFIED_MSG });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: true, message: UNIFIED_MSG });

  if (!rateLimit(`fp:email:${email}`, 3, 15 * 60 * 1000).allowed) {
    return NextResponse.json({ ok: true, message: UNIFIED_MSG });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.passwordHash) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await sendPasswordResetEmail(user.email, rawToken);
    }
  } catch (e) {
    console.error("[forgot-password] error", e);
  }
  return NextResponse.json({ ok: true, message: UNIFIED_MSG });
}
