import crypto from "crypto";
import { prisma } from "./db";

// ==================== 常量 ====================
export const INV_STATUS = {
  PENDING_VIEW: "PENDING_VIEW",
  VIEWED: "VIEWED",
  ACCEPTED: "ACCEPTED",
  QUOTED: "QUOTED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;

export const INV_STATUS_CN: Record<string, string> = {
  PENDING_VIEW: "待查看",
  VIEWED: "已查看",
  ACCEPTED: "已接受",
  QUOTED: "已报价",
  REJECTED: "已拒绝",
  EXPIRED: "已过期",
};

export const REJECT_REASONS = ["无法供应", "数量不足", "交期无法满足", "产品不在经营范围", "其他"];

export function genInviteToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

// ==================== 站内信 ====================
export async function notifyUser(
  userId: number,
  type: string,
  title: string,
  content?: string,
  link?: string
) {
  if (!userId) return;
  try {
    await prisma.notification.create({
      data: { userId, type, title, content: content || "", link: link || null },
    });
  } catch (e) {
    console.error("【站内信发送失败】", e);
  }
}

/** 未读站内信数量（供工作台角标） */
export async function unreadNotificationCount(userId: number) {
  if (!userId) return 0;
  return prisma.notification.count({ where: { userId, readAt: null } });
}

// ==================== 智能推荐供应商 ====================
export interface RecommendedSupplier {
  supplier: {
    id: number;
    name: string;
    shortName: string | null;
    province: string | null;
    city: string | null;
    mainBrands: string | null;
    mainEquipment: string | null;
    mainBusiness: string | null;
    verifiedStatus: string;
    memberLevel: string;
  };
  score: number;
  reasons: string[];
  quoteCount: number; // 该供应商的历史报价次数
}

/**
 * 根据 RFQ 的 品牌 + 设备型号 + 件号/配件 + 历史报价 智能匹配供应商，打分排序，返回 5~20 家。
 * 只返回"唯一 Supplier"，同一供应商不论命中多少产品/件号只出现一次。
 */
export async function recommendSuppliersForRFQ(rfqId: number, limit = 20): Promise<RecommendedSupplier[]> {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
    include: { items: { orderBy: { seq: "asc" } } },
  });
  if (!rfq) return [];

  // 1) 从 RFQItem 提取特征（兼容旧单件号 RFQ：无 items 时用 RFQ 顶层字段）
  const brands = new Set<string>();
  const equipmentModels = new Set<string>();
  const partNumbers = new Set<string>();
  const productNames = new Set<string>();
  const collect = (brand?: string | null, eq?: string | null, pn?: string | null, pnName?: string | null) => {
    if (brand) brands.add(brand.trim());
    if (eq) equipmentModels.add(eq.trim());
    if (pn) partNumbers.add(pn.trim());
    if (pnName) productNames.add(pnName.trim());
  };
  if (rfq.items.length > 0) {
    for (const it of rfq.items) collect(it.brandName, it.equipmentModel, it.partNumberStr, it.productName);
  } else {
    collect(rfq.brandName, rfq.equipmentModel, rfq.partNumberStr, rfq.productName);
  }

  // 2) 粗筛候选：任一特征命中的供应商（禁用账号排除）
  const orConds: any[] = [];
  if (brands.size) orConds.push({ mainBrands: { contains: Array.from(brands)[0] } });
  if (equipmentModels.size) orConds.push({ mainEquipment: { contains: Array.from(equipmentModels)[0] } });
  if (partNumbers.size)
    orConds.push({ products: { some: { partNumber: { number: { contains: Array.from(partNumbers)[0] } } } } });
  if (partNumbers.size) orConds.push({ products: { some: { oemNumber: { contains: Array.from(partNumbers)[0] } } } });
  // 历史报价过相同品牌/设备的供应商
  if (brands.size || equipmentModels.size) {
    orConds.push({
      quotes: {
        some: {
          rfq: {
            OR: [
              ...(brands.size ? [{ brandName: { in: Array.from(brands) } }] : []),
              ...(equipmentModels.size ? [{ equipmentModel: { in: Array.from(equipmentModels) } }] : []),
            ],
          },
        },
      },
    });
  }

  const where: any = {
    users: { none: { status: "DISABLED" } },
  };
  if (orConds.length > 0) where.OR = orConds;

  // 认证优先但不强制（避免小数据量时推荐为空；未认证在 reasons 中提示）
  const candidates = await prisma.supplier.findMany({
    where,
    select: {
      id: true,
      name: true,
      shortName: true,
      province: true,
      city: true,
      mainBrands: true,
      mainEquipment: true,
      mainBusiness: true,
      verifiedStatus: true,
      memberLevel: true,
      products: {
        select: { id: true, partNumber: { select: { number: true } }, oemNumber: true, name: true },
        take: 100,
      },
    },
    take: 200,
  });

  // 3) 打分
  const brandArr = Array.from(brands).filter(Boolean);
  const eqArr = Array.from(equipmentModels).filter(Boolean);
  const pnArr = Array.from(partNumbers).filter(Boolean);
  const nameArr = Array.from(productNames).filter(Boolean);

  const scored: RecommendedSupplier[] = candidates.map((s) => {
    let score = 0;
    const reasons: string[] = [];
    const mainBrands = s.mainBrands || "";
    const mainEquipment = s.mainEquipment || "";
    const mainBusiness = s.mainBusiness || "";
    const prodText = s.products
      .map((p) => `${p.partNumber?.number || ""} ${p.oemNumber || ""} ${p.name || ""}`)
      .join(" ");

    // 件号精确匹配：权重最高
    for (const pn of pnArr) {
      const pnHit = s.products.some((p) => (p.partNumber?.number || "") === pn || (p.oemNumber || "") === pn);
      if (pnHit) { score += 5; reasons.push(`供应件号 ${pn}`); }
      else if (prodText.includes(pn)) { score += 3; reasons.push(`件号相关 ${pn}`); }
    }
    // 配件名称
    for (const nm of nameArr) {
      if (mainBusiness.includes(nm) || prodText.includes(nm)) { score += 3; reasons.push(`主营包含 ${nm}`); }
    }
    // 品牌
    for (const b of brandArr) {
      if (mainBrands.includes(b)) { score += 3; reasons.push(`主营品牌 ${b}`); }
    }
    // 设备型号
    for (const eq of eqArr) {
      if (mainEquipment.includes(eq)) { score += 2; reasons.push(`主营设备 ${eq}`); }
    }
    // 认证与会员
    if (s.verifiedStatus === "VERIFIED") { score += 2; }
    else { reasons.push("待认证"); }
    if (s.memberLevel === "GOLD") score += 1;
    if (s.memberLevel === "SILVER") score += 0.5;

    return { supplier: s, score, reasons: reasons.slice(0, 3), quoteCount: 0 };
  });

  // 历史报价次数（该供应商整体报价数）
  const quoteCounts = await prisma.quote.groupBy({
    by: ["supplierId"],
    where: { supplierId: { in: scored.map((s) => s.supplier.id) } },
    _count: { _all: true },
  });
  const qcMap = new Map(quoteCounts.map((q) => [q.supplierId, q._count._all]));
  for (const s of scored) {
    s.quoteCount = qcMap.get(s.supplier.id) || 0;
    if (s.quoteCount > 0) s.score += Math.min(2, s.quoteCount * 0.1);
  }

  scored.sort((a, b) => b.score - a.score);
  const min = Math.min(20, Math.max(5, scored.length));
  return scored.slice(0, min);
}

// ==================== 创建邀请（防重） ====================
export interface ExternalInviteInput {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
}

/**
 * 创建/再次邀请。注册供应商：rfqId+supplierId 联合唯一，重复则只更新 lastReminderAt + reminderCount+1（不建重复记录）。
 * 外部供应商：创建独立记录（带唯一 token）。
 * 返回 { created, reminded, failed }
 */
export async function createInvitationsForRFQ(
  rfqId: number,
  buyerUserId: number,
  supplierIds: number[],
  externals: ExternalInviteInput[]
): Promise<{ created: number; reminded: number; failed: number; error?: string }> {
  const result: { created: number; reminded: number; failed: number; error?: string } = { created: 0, reminded: 0, failed: 0 };
  const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { id: true, title: true, rfqNo: true } });
  if (!rfq) return { ...result, error: "RFQ 不存在" };

  await prisma.$transaction(async (tx) => {
    // 注册供应商
    const uniqIds = Array.from(new Set(supplierIds.filter(Boolean)));
    for (const sid of uniqIds) {
      const existing = await tx.rFQInvitation.findUnique({
        where: { rfqId_supplierId: { rfqId, supplierId: sid } },
      });
      if (existing) {
        await tx.rFQInvitation.update({
          where: { id: existing.id },
          data: { lastReminderAt: new Date(), reminderCount: { increment: 1 } },
        });
        result.reminded++;
      } else {
        const inv = await tx.rFQInvitation.create({
          data: { rfqId, supplierId: sid, token: genInviteToken() },
        });
        result.created++;
        // 站内信给该供应商的 User
        const supplier = await tx.supplier.findUnique({
          where: { id: sid },
          select: { users: { select: { id: true } }, name: true },
        });
        const uid = supplier?.users?.[0]?.id;
        if (uid) {
          await tx.notification.create({
            data: {
              userId: uid,
              type: "RFQ_INVITATION",
              title: "您收到新的询价邀请",
              content: `采购方邀请您对询价「${rfq.title}」（${rfq.rfqNo || `#${rfq.id}`}）报价`,
              link: `/supplier/invitations?highlight=${inv.id}`,
            },
          });
        }
      }
    }
    // 外部供应商
    for (const ext of externals) {
      const company = (ext.companyName || "").trim();
      const contact = (ext.contactName || "").trim();
      const email = (ext.email || "").trim();
      const phone = (ext.phone || "").trim();
      if (!company && !email && !phone) { result.failed++; continue; }
      await tx.rFQInvitation.create({
        data: {
          rfqId,
          externalCompanyName: company || null,
          externalContactName: contact || null,
          externalEmail: email || null,
          externalPhone: phone || null,
          token: genInviteToken(),
        },
      });
      result.created++;
    }
  });

  return result;
}

/** 采购商"再次邀请"：只更新 lastReminderAt + reminderCount+1，禁止重复记录 */
export async function remindInvitation(invitationId: number) {
  return prisma.rFQInvitation.update({
    where: { id: invitationId },
    data: { lastReminderAt: new Date(), reminderCount: { increment: 1 } },
  });
}

// ==================== 供应商响应 ====================
/** 查看即标记（VIEWED） */
export async function markInvitationViewed(invitationId: number) {
  const inv = await prisma.rFQInvitation.findUnique({
    where: { id: invitationId },
    select: { status: true, viewedAt: true },
  });
  if (inv && (inv.status === "PENDING_VIEW" || inv.status === "VIEWED")) {
    await prisma.rFQInvitation.update({
      where: { id: invitationId },
      data: { status: inv.status === "PENDING_VIEW" ? "VIEWED" : inv.status, viewedAt: inv.viewedAt || new Date() },
    });
  }
}

/** 接受并报价：状态 → ACCEPTED（保留已报价状态不被降级） */
export async function acceptInvitation(invitationId: number) {
  return prisma.rFQInvitation.update({
    where: { id: invitationId },
    data: {
      status: INV_STATUS.ACCEPTED,
      viewedAt: new Date(),
      respondedAt: new Date(),
      rejectReason: null,
    },
  });
}

/** 暂不报价：记录原因 */
export async function rejectInvitation(invitationId: number, reason: string) {
  return prisma.rFQInvitation.update({
    where: { id: invitationId },
    data: {
      status: INV_STATUS.REJECTED,
      viewedAt: new Date(),
      respondedAt: new Date(),
      rejectReason: reason,
    },
  });
}

/** 报价提交后由报价流程调用：邀请状态 → QUOTED（不阻塞报价，报价页成功后调用） */
export async function markInvitationQuoted(invitationId: number | null) {
  if (!invitationId) return;
  await prisma.rFQInvitation.update({
    where: { id: invitationId },
    data: { status: INV_STATUS.QUOTED, respondedAt: new Date() },
  });
}

// ==================== 外部邀请绑定 ====================
/** 注册/登录后：将外部邀请绑定到当前供应商（只写 supplierId，不改 token） */
export async function bindInvitationToSupplier(token: string, supplierId: number) {
  const inv = await prisma.rFQInvitation.findUnique({ where: { token } });
  if (!inv) return null;
  const data: any = {
    supplierId,
    externalCompanyName: inv.externalCompanyName || null,
    viewedAt: inv.viewedAt || new Date(),
    status: inv.status === "PENDING_VIEW" ? "VIEWED" : inv.status,
  };
  return prisma.rFQInvitation.update({ where: { id: inv.id }, data });
}

/** 根据 token 读取外部邀请（含 RFQ 信息），供公开邀请页使用 */
export async function getInvitationByToken(token: string) {
  return prisma.rFQInvitation.findUnique({
    where: { token },
    include: {
      rfq: {
        include: {
          items: { include: { partNumber: true }, orderBy: { seq: "asc" } },
          _count: { select: { quotes: true } },
        },
      },
    },
  });
}

/** 校验 token 是否可报价（未过期 RFQ + 邀请未拒绝） */
export function invitationCanQuote(inv: { status: string }, rfqStatus: string) {
  if (inv.status === "REJECTED") return false;
  if (rfqStatus === "CLOSED" || rfqStatus === "EXPIRED") return false;
  return true;
}
