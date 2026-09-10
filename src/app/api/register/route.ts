import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { contactName, phone, email, password } = body;
    // 只允许 SUPPLIER 或 BUYER，忽略客户端传入的 ADMIN
    const requestedRole: string = body.role === "BUYER" ? "BUYER" : "SUPPLIER";

    if (!contactName || !phone || !email || !password) {
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

    if (requestedRole === "BUYER") {
      // 采购商：只建 User，不建 Supplier
      await prisma.user.create({
        data: {
          email,
          name: contactName,
          phone,
          passwordHash,
          role: "BUYER",
          status: "ACTIVE",
        },
      });
      return NextResponse.json({ success: true, message: "注册成功，请登录" });
    }

    // 供应商：必须填企业名
    const company = (body.company || "").trim();
    if (!company) {
      return NextResponse.json({ success: false, message: "供应商注册请填写企业全称" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: contactName,
          passwordHash,
          role: "SUPPLIER",
          company,
          phone,
          status: "PENDING",
        },
      });

      const supplier = await tx.supplier.create({
        data: {
          name: company,
          slug: `co-${Date.now()}-${user.id}`,
          contactName,
          mobile: phone,
          email,
          verifiedStatus: "PENDING",
          memberLevel: "FREE",
          mainBusiness: "",
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { supplierId: supplier.id },
      });
    });

    return NextResponse.json({ success: true, message: "注册成功，请等待管理员审核企业" });
  } catch (e: any) {
    console.error("register error:", e);
    return NextResponse.json({ success: false, message: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
