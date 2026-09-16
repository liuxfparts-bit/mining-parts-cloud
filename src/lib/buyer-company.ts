import { prisma } from "./db";

// ==================== 常量 ====================
export const BUYER_VERIFY_STATUS = {
  UNSUBMITTED: "UNSUBMITTED",
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;

export const BUYER_VERIFY_STATUS_CN: Record<string, string> = {
  UNSUBMITTED: "未提交",
  PENDING: "待审核",
  VERIFIED: "已认证",
  REJECTED: "已驳回",
};

export const BUYER_LEVEL = {
  NORMAL: "NORMAL",
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
} as const;

export const BUYER_LEVEL_CN: Record<string, string> = {
  NORMAL: "普通",
  BRONZE: "铜牌",
  SILVER: "银牌",
  GOLD: "金牌",
};

export const BUYER_LEVEL_BADGE: Record<string, string> = {
  NORMAL: "bg-slate-100 text-slate-600",
  BRONZE: "bg-orange-50 text-orange-700 border border-orange-200",
  SILVER: "bg-slate-100 text-slate-600 border border-slate-300",
  GOLD: "bg-yellow-50 text-yellow-700 border border-yellow-300",
};

// ==================== 查询 ====================
/** 取当前用户所属采购商企业（含企业下所有成员） */
export async function getBuyerCompanyForUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, buyerCompanyId: true },
  });
  if (!user?.buyerCompanyId) return null;
  return prisma.buyerCompany.findUnique({
    where: { id: user.buyerCompanyId },
    include: { users: { select: { id: true, name: true, email: true, phone: true, isOwner: true, position: true, status: true, createdAt: true } } },
  });
}

/** 当前用户所在企业（无则 null） */
export async function getBuyerCompanyByUserId(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { buyerCompanyId: true },
  });
  if (!user?.buyerCompanyId) return null;
  return prisma.buyerCompany.findUnique({ where: { id: user.buyerCompanyId } });
}

/** 同一企业下所有 User id（主账号 + 子账号，用于 RFQ 企业共享查询） */
export async function getCompanyUserIds(userId: number): Promise<number[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { buyerCompanyId: true },
  });
  if (!user?.buyerCompanyId) return [userId];
  const members = await prisma.user.findMany({
    where: { buyerCompanyId: user.buyerCompanyId, status: "ACTIVE" },
    select: { id: true },
  });
  return members.map((m) => m.id);
}

// ==================== 认证拦截 ====================
export interface VerifyGateResult {
  allowed: boolean;
  reason?: string; // 拦截原因
  company?: {
    id: number;
    verifiedStatus: string;
    level: string;
    companyName: string;
  } | null;
}

/**
 * 采购商发布 RFQ / 邀请供应商 的认证门槛：
 * BUYER 角色必须企业认证通过（VERIFIED）才允许；SUPPLIER/ADMIN 不拦截。
 */
export async function requireVerifiedBuyer(userId: number): Promise<VerifyGateResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, buyerCompanyId: true },
  });
  if (!user) return { allowed: false, reason: "登录已失效，请重新登录" };
  if (user.role !== "BUYER") return { allowed: true };

  if (!user.buyerCompanyId) {
    return { allowed: false, reason: "请先提交企业认证后再发布询价", company: null };
  }
  const company = await prisma.buyerCompany.findUnique({
    where: { id: user.buyerCompanyId },
    select: { id: true, verifiedStatus: true, level: true, companyName: true, rejectionReason: true },
  });
  if (!company || company.verifiedStatus !== "VERIFIED") {
    return {
      allowed: false,
      reason:
        company?.verifiedStatus === "PENDING"
          ? "企业认证正在审核中，审核通过后可发布询价"
          : company?.verifiedStatus === "REJECTED"
            ? `企业认证未通过，请修改后重新提交（${company?.rejectionReason || "原因见认证页"}）`
            : "请先完成企业认证后再发布询价",
      company,
    };
  }
  return { allowed: true, company };
}
