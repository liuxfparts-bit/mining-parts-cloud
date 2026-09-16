"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** 仅企业主账号可操作团队管理（服务端校验，isOwner=false 一律拒绝） */
async function requireOwner() {
  const session = await auth();
  const email = (session?.user as any)?.email;
  if (!email) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase() },
    select: { id: true, role: true, isOwner: true, buyerCompanyId: true, company: true },
  });
  if (!user || user.role !== "BUYER" || !user.isOwner || !user.buyerCompanyId) redirect("/dashboard");
  return user;
}

export async function addTeamMember(formData: FormData) {
  const owner = await requireOwner();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const password = String(formData.get("password") || "");
  const position = String(formData.get("position") || "").trim();

  if (!name || !email || !password) {
    throw new Error("请填写姓名、邮箱和初始密码");
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new Error("该邮箱已注册，请更换邮箱或直接为其重置密码");
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
    },
  });

  revalidatePath("/dashboard/team");
}

export async function toggleMemberStatus(formData: FormData) {
  const owner = await requireOwner();
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
}

export async function resetMemberPassword(formData: FormData) {
  const owner = await requireOwner();
  const memberId = parseInt(String(formData.get("memberId") || ""));
  const newPassword = String(formData.get("newPassword") || "");
  if (isNaN(memberId) || !newPassword) throw new Error("请填写新密码");

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { buyerCompanyId: true, isOwner: true },
  });
  if (!member || member.buyerCompanyId !== owner.buyerCompanyId || member.isOwner) {
    throw new Error("无权操作该成员");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: memberId }, data: { passwordHash } });
  revalidatePath("/dashboard/team");
}
