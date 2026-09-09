import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { company, contactName, phone, email, password } = await req.json();

    if (!company || !contactName || !phone || !email || !password) {
      return NextResponse.json({ success: false, message: "请填写完整信息" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ success: false, message: "密码至少6位" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ success: false, message: "该邮箱已注册，请直接登录" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        name: contactName,
        passwordHash,
        role: "SUPPLIER",
        company,
        phone,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ success: true, message: "注册成功" });
  } catch (e: any) {
    console.error("register error:", e);
    return NextResponse.json({ success: false, message: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
