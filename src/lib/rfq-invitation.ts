import crypto from "crypto";
import type { Prisma, RFQInvitation } from "@prisma/client";
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

type InvitationStatus = (typeof INV_STATUS)[keyof typeof INV_STATUS];
type InvitationDb = Pick<Prisma.TransactionClient, "rFQInvitation">;

// Explicit allowlist: unknown states fail closed; terminal states cannot reopen.
const TRANSITIONS: Record<InvitationStatus, readonly string[]> = {
  PENDING_VIEW: ["VIEWED", "ACCEPTED", "REJECTED", "QUOTED", "EXPIRED"],
  VIEWED: ["ACCEPTED", "REJECTED", "QUOTED", "EXPIRED"],
  ACCEPTED: ["REJECTED", "QUOTED", "EXPIRED"],
  QUOTED: [],
  REJECTED: ["EXPIRED"],
  EXPIRED: [],
};

export function canTransitionInvitation(from: string, to: string): boolean {
  return Object.hasOwn(TRANSITIONS, from) && Object.hasOwn(TRANSITIONS, to) &&
    (from === to || TRANSITIONS[from as InvitationStatus].includes(to));
}

const REMINDABLE_STATUSES = ["PENDING_VIEW", "VIEWED", "ACCEPTED", "REJECTED"];

function validSupplierId(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= 2147483647;
}

// Lock before reading the TEXT JSON so concurrent grants merge the latest set.
// All callers must hold this lock until their invitation transaction commits.
async function lockInvitationRfq(tx: Prisma.TransactionClient, rfqId: number) {
  await tx.$queryRaw`SELECT "id" FROM "RFQ" WHERE "id" = ${rfqId} FOR UPDATE`;
  return tx.rFQ.findUnique({ where: { id: rfqId } });
}

async function authorizeInvitedSupplier(
  tx: Prisma.TransactionClient,
  rfq: { id: number; visibility: string; matchedSuppliers: string | null },
  supplierId: number
) {
  if (!validSupplierId(supplierId)) throw new Error("无效供应商");
  if (rfq.visibility === "PUBLIC") return;
  if (rfq.visibility !== "MATCHED_SUPPLIERS") return; // PRIVATE never grants access.
  let ids: unknown;
  try {
    ids = typeof rfq.matchedSuppliers === "string" ? JSON.parse(rfq.matchedSuppliers) : null;
  } catch {
    throw new Error("询价授权数据无效，请联系管理员");
  }
  if (!Array.isArray(ids) || !ids.every(validSupplierId)) {
    throw new Error("询价授权数据无效，请联系管理员");
  }
  const merged = JSON.stringify(Array.from(new Set([...ids, supplierId])));
  if (merged !== rfq.matchedSuppliers) {
    await tx.rFQ.update({ where: { id: rfq.id }, data: { matchedSuppliers: merged } });
    rfq.matchedSuppliers = merged;
  }
}

/** Conditional writes prevent stale reads from overwriting a newer state/binding. */
async function transitionInvitation(
  where: Prisma.RFQInvitationWhereUniqueInput,
  target: InvitationStatus,
  db: InvitationDb = prisma,
  scope?: { rfqId: number; supplierId: number },
  rejectReason?: string
) {
  const inv = await db.rFQInvitation.findUnique({ where });
  if (!inv || (scope && (inv.rfqId !== scope.rfqId || inv.supplierId !== scope.supplierId))) return null;
  if (!canTransitionInvitation(inv.status, target)) return null;
  if (inv.status === target) return inv; // Idempotent: preserve timestamps/reason.
  const data = {
    status: target,
    ...(target === "VIEWED" || target === "ACCEPTED" || target === "REJECTED"
      ? { viewedAt: inv.viewedAt || new Date() } : {}),
    ...(target === "ACCEPTED" || target === "REJECTED" || target === "QUOTED"
      ? { respondedAt: new Date() } : {}),
    ...(target === "ACCEPTED" ? { rejectReason: null } : {}),
    ...(target === "REJECTED" ? { rejectReason } : {}),
  };
  const updated = await db.rFQInvitation.updateMany({
    where: { id: inv.id, status: inv.status, supplierId: inv.supplierId, ...(scope || {}) },
    data,
  });
  return updated.count === 1 ? { ...inv, ...data } : null;
}

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
  await prisma.$transaction(async (tx) => {
    const rfq = await lockInvitationRfq(tx, rfqId);
    const buyer = await tx.user.findUnique({ where: { id: buyerUserId } });
    if (!rfq || buyer?.role !== "BUYER" ||
      (rfq.userID !== buyer.id && !(rfq.companyID != null && rfq.companyID === buyer.buyerCompanyId))) {
      throw new Error("无权邀请供应商");
    }
    if (rfq.visibility === "PRIVATE") {
      throw new Error("私密询价不可邀请供应商");
    }
    // 注册供应商
    const uniqIds = Array.from(new Set(supplierIds));
    for (const sid of uniqIds) {
      if (!validSupplierId(sid)) { result.failed++; continue; }
      // Buyer selections are untrusted until resolved to an existing supplier.
      const supplier = await tx.supplier.findUnique({
        where: { id: sid }, select: { id: true, users: { select: { id: true } }, name: true },
      });
      if (!supplier) { result.failed++; continue; }
      const existing = await tx.rFQInvitation.findUnique({
        where: { rfqId_supplierId: { rfqId, supplierId: supplier.id } },
      });
      if (existing) {
        const reminded = await remindInvitation(existing.id, tx);
        if (reminded) result.reminded++;
        else result.failed++;
        if (reminded && ["PENDING_VIEW", "VIEWED", "ACCEPTED"].includes(existing.status) &&
          rfq.status !== "CLOSED" && rfq.status !== "EXPIRED") {
          await authorizeInvitedSupplier(tx, rfq, supplier.id);
        }
      } else {
        const inv = await tx.rFQInvitation.create({
          data: { rfqId, supplierId: supplier.id, token: genInviteToken() },
        });
        if (rfq.status !== "CLOSED" && rfq.status !== "EXPIRED") {
          await authorizeInvitedSupplier(tx, rfq, supplier.id);
        }
        result.created++;
        // 站内信给该供应商的 User
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
export async function remindInvitation(invitationId: number, db: InvitationDb = prisma) {
  const updated = await db.rFQInvitation.updateMany({
    where: { id: invitationId, status: { in: REMINDABLE_STATUSES } },
    data: { lastReminderAt: new Date(), reminderCount: { increment: 1 } },
  });
  return updated.count === 1;
}

// ==================== 供应商响应 ====================
/** 查看即标记（VIEWED） */
export async function markInvitationViewed(invitationId: number) {
  return transitionInvitation({ id: invitationId }, INV_STATUS.VIEWED);
}

/** 接受并报价：状态 → ACCEPTED（保留已报价状态不被降级） */
export async function acceptInvitation(invitationId: number) {
  return transitionInvitation({ id: invitationId }, INV_STATUS.ACCEPTED);
}

/** 暂不报价：记录原因 */
export async function rejectInvitation(invitationId: number, reason: string) {
  return transitionInvitation({ id: invitationId }, INV_STATUS.REJECTED, prisma, undefined, reason);
}

/** Called inside the quote transaction; supplierId must come from the server user. */
export async function markInvitationQuoted(
  token: string, rfqId: number, supplierId: number, db: InvitationDb
) {
  if (!token || !validSupplierId(supplierId)) return null;
  return transitionInvitation({ token }, INV_STATUS.QUOTED, db, { rfqId, supplierId });
}

// ==================== 外部邀请绑定 ====================
/** Bind the server-derived supplier and authorize this RFQ atomically; never reassign. */
export async function bindInvitationToSupplier(
  token: string, supplierId: number, db?: Prisma.TransactionClient, external: ExternalInviteInput = {}
): Promise<RFQInvitation | null> {
  if (!validSupplierId(supplierId)) return null;
  if (!db) return prisma.$transaction((tx) => bindInvitationToSupplier(token, supplierId, tx, external));
  const initial = await db.rFQInvitation.findUnique({ where: { token } });
  if (!initial || (initial.supplierId !== null && initial.supplierId !== supplierId)) return null;
  const rfq = await lockInvitationRfq(db, initial.rfqId);
  // RFQ first, invitation second: preserve lock order and prevent a terminal
  // transition racing an idempotent binding's missing authorization repair.
  await db.$queryRaw`SELECT "id" FROM "RFQInvitation" WHERE "token" = ${token} FOR UPDATE`;
  const inv = await db.rFQInvitation.findUnique({ where: { token } });
  if (!rfq || !inv || inv.rfqId !== rfq.id || (inv.supplierId !== null && inv.supplierId !== supplierId)) return null;
  // Terminal invitations cannot establish new visibility authorization.
  if (!["PENDING_VIEW", "VIEWED", "ACCEPTED"].includes(inv.status)) return inv.supplierId === supplierId ? inv : null;
  if (rfq.status === "CLOSED" || rfq.status === "EXPIRED" ||
    !["PUBLIC", "MATCHED_SUPPLIERS"].includes(rfq.visibility)) return null;
  const supplier = await db.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
  if (!supplier) return null;
  if (inv.supplierId === supplier.id) {
    await authorizeInvitedSupplier(db, rfq, supplier.id);
    return inv;
  }
  const data = {
    supplierId,
    externalCompanyName: inv.externalCompanyName || external.companyName || null,
    externalContactName: inv.externalContactName || external.contactName || null,
    externalEmail: inv.externalEmail || external.email || null,
    externalPhone: inv.externalPhone || external.phone || null,
    viewedAt: inv.viewedAt || new Date(),
    status: inv.status === "PENDING_VIEW" ? "VIEWED" : inv.status,
  };
  const updated = await db.rFQInvitation.updateMany({
    where: { id: inv.id, supplierId: null, status: inv.status }, data,
  });
  if (updated.count !== 1) return null;
  await authorizeInvitedSupplier(db, rfq, supplier.id);
  return { ...inv, ...data };
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

/** Lifecycle hint only; never replaces canSupplierAccessRfq authorization. */
export function invitationCanQuote(inv: { status: string }, rfqStatus: string) {
  if (!["COLLECTING", "QUOTED"].includes(rfqStatus)) return false;
  return canTransitionInvitation(inv.status, INV_STATUS.QUOTED);
}
