"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface TeamActionResult {
  success: boolean;
  error?: string;
  message?: string;
}

/** 当前登录用户（服务端会话取身份，不信任前端参数） */
async function findOwner() {
  const session = await auth();
  const email = (session?.user as any)?.email;
  if (!email) return null;
  return prisma.user.findUnique({
    where: { email: String(email).toLowerCase() },
    select: { id: true, role: true, isOwner: true, buyerCompanyId: true, company: true },
  });
}

export async function addTeamMember(
  _prev: TeamActionResult,
  formData: FormData,
): Promise<TeamActionResult> {
  try {
    const owner = await findOwner();
    if (!owner || owner.role !== "BUYER" || !owner.isOwner) {
      return { success: false, error: "仅企业主账号可管理团队" };
    }
    if (!owner.buyerCompanyId) {
      return { success: false, error: "请先完善企业资料（企业认证页）后再添加采购员" };
    }

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const password = String(formData.get("password") || "");
    const position = String(formData.get("position") || "").trim();

    if (!name || !email || !password) {
      return { success: false, error: "请填写姓名、邮箱和初始密码" };
    }
    if (password.length < 6) {
      return { success: false, error: "初始密码至少 6 位" };
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return { success: false, error: "该邮箱已注册，请更换邮箱或直接为其重置密码" };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        name,
        phone: phone || null,
        passwordHash,
        position: position || "采购员",
        role: "BUYER",
        buyerCompanyId: owner.buyerCompanyId,
        isOwner: false,
        company: owner.company || undefined,
        status: "ACTIVE",
      },
    });

    revalidatePath("/dashboard/team");
    return { success: true, message: `已添加采购员「${name}」，初始密码可登录` };
  } catch (e: any) {
    console.error("addTeamMember error:", e);
    if (e?.code === "P2002") return { success: false, error: "该邮箱已注册，请更换邮箱" };
    return { success: false, error: e instanceof Error ? e.message : "添加失败，请稍后重试" };
  }
}

export async function toggleMemberStatus(formData: FormData): Promise<void> {
  try {
    const owner = await findOwner();
    if (!owner || owner.role !== "BUYER" || !owner.isOwner || !owner.buyerCompanyId) return;
    const memberId = parseInt(String(formData.get("memberId") || ""));
    if (isNaN(memberId)) return;

    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: { buyerCompanyId: true, isOwner: true, status: true },
    });
    if (!member || member.buyerCompanyId !== owner.buyerCompanyId || member.isOwner) return;

    await prisma.user.update({
      where: { id: memberId },
      data: { status: member.status === "ACTIVE" ? "DISABLED" : "ACTIVE" },
    });
    revalidatePath("/dashboard/team");
  } catch (e: any) {
    console.error("toggleMemberStatus error:", e);
  }
}

export async function resetMemberPassword(formData: FormData): Promise<void> {
  try {
    const owner = await findOwner();
    if (!owner || owner.role !== "BUYER" || !owner.isOwner || !owner.buyerCompanyId) return;
    const memberId = parseInt(String(formData.get("memberId") || ""));
    const newPassword = String(formData.get("newPassword") || "");
    if (isNaN(memberId) || !newPassword) return;

    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: { buyerCompanyId: true, isOwner: true },
    });
    if (!member || member.buyerCompanyId !== owner.buyerCompanyId || member.isOwner) return;

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: memberId }, data: { passwordHash } });
    revalidatePath("/dashboard/team");
  } catch (e: any) {
    console.error("resetMemberPassword error:", e);
  }
}
