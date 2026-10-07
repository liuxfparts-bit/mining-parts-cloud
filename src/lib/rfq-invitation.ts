import crypto from "crypto";
import type { Prisma, RFQInvitation } from "@prisma/client";
import { prisma } from "./db";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/public-product";

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
export type CapabilityTrustTier = "TRUSTED" | "OBSERVED" | "CLAIMED";

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
    approvedAt: Date | null;
    approvedBy: number | null;
    memberLevel: string;
  };
  trustTier: CapabilityTrustTier;
  score: number;
  reasons: string[];
  quoteCount: number;
}

const TRUST_TIER_RANK: Record<CapabilityTrustTier, number> = {
  TRUSTED: 3,
  OBSERVED: 2,
  CLAIMED: 1,
};

/**
 * Trusted Capability V1.0 recommendation policy:
 * 1) assign trust tier first (TRUSTED > OBSERVED > CLAIMED)
 * 2) score relevance only inside that tier
 * 3) membership level never upgrades trust
 */
export async function recommendSuppliersForRFQ(rfqId: number, limit = 20): Promise<RecommendedSupplier[]> {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
    include: { items: { orderBy: { seq: "asc" } } },
  });
  if (!rfq) return [];

  const brands = new Set<string>();
  const equipmentModels = new Set<string>();
  const partNumbers = new Set<string>();
  const trustedPartNumberIds = new Set<number>();
  const productNames = new Set<string>();
  const collect = (
    brand?: string | null,
    eq?: string | null,
    pn?: string | null,
    pnName?: string | null,
    partNumberId?: number | null
  ) => {
    if (brand) brands.add(brand.trim());
    if (eq) equipmentModels.add(eq.trim());
    if (pn) partNumbers.add(pn.trim());
    if (pnName) productNames.add(pnName.trim());
    if (partNumberId) trustedPartNumberIds.add(partNumberId);
  };
  if (rfq.items.length > 0) {
    for (const it of rfq.items) {
      collect(it.brandName, it.equipmentModel, it.partNumberStr, it.productName, it.partNumberId);
    }
  } else {
    collect(rfq.brandName, rfq.equipmentModel, rfq.partNumberStr, rfq.productName, rfq.partNumberId);
  }

  const brandArr = Array.from(brands).filter(Boolean);
  const eqArr = Array.from(equipmentModels).filter(Boolean);
  const pnArr = Array.from(partNumbers).filter(Boolean);
  const nameArr = Array.from(productNames).filter(Boolean);

  // Candidate discovery may use claims, but discovery itself never grants trust.
  const orConds: Prisma.SupplierWhereInput[] = [];
  if (brandArr.length) orConds.push({ mainBrands: { contains: brandArr[0] } });
  if (eqArr.length) orConds.push({ mainEquipment: { contains: eqArr[0] } });
  if (pnArr.length) {
    orConds.push({ products: { some: { partNumber: { number: { contains: pnArr[0] } } } } });
    orConds.push({ products: { some: { oemNumber: { contains: pnArr[0] } } } });
  }
  if (brandArr.length || eqArr.length || pnArr.length) {
    orConds.push({
      quotes: {
        some: {
          businessAuthenticity: "REAL",
          rfq: {
            OR: [
              ...(brandArr.length ? [{brandName: { in: brandArr } }] : []),
              ...(eqArr.length ? [{ equipmentModel: { in: eqArr } } ] : []),
              ...(pnArr.length ? [{ partNumberStr: { in: pnArr } }] : []),
              ...(pnArr.length ? [{ items: { some: { partNumberStr: { in: pnArr } } } }] : []),
            ],
          },
        },
      },
    });
  }

  const where: Prisma.SupplierWhereInput = {
    users: { none: { status: "DISABLED" } },
    ...(orConds.length ? { OR: orConds } : {}),
  };

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
      approvedAt: true,
      approvedBy: true,
      memberLevel: true,
      products: {
        select: { id: true, partNumber: { select: { number: true } }, oemNumber: true, name: true },
        take: 100,
      },
    },
    take: 200,
  });
  if (!candidates.length) return [];

  const candidateIds = candidates.map((s) => s.id);

  // Automatic TRUSTED recommendation requires the canonical public trusted capability:
  // reviewed Product/PN/Supplier chain plus Product.status=PUBLISHED. OFFLINE evidence is retained but not recommended.
  const trustedProducts = (trustedPartNumberIds.size || pnArr.length)
    ? await prisma.product.findMany({
        where: {
          supplierId: { in: candidateIds },
          ...PUBLIC_PRODUCT_WHERE,
          OR: [
            ...(trustedPartNumberIds.size
              ? [{ partNumberId: { in: Array.from(trustedPartNumberIds) } }]
              : []),
            ...(pnArr.length
              ? [{ partNumber: { number: { in: pnArr, mode: "insensitive" as const } } }]
              : []),
          ],
        },
        select: { supplierId: true },
      })
    : [];
  const trustedSupplierIds = new Set(trustedProducts.map((p) => p.supplierId));

  // OBSERVED means a REAL quote relevant to this RFQ. It is commercial evidence,
  // never technical verification and never an automatic upgrade to TRUSTED.
  const observedQuotes = await prisma.quote.findMany({
    where: {
      supplierId: { in: candidateIds },
      businessAuthenticity: "REAL",
      ...(brandArr.length || eqArr.length || pnArr.length
        ? {
            rfq: {
              OR: [
                ...(brandArr.length ? [{ brandName: { in: brandArr } }] : []),
                ...(eqArr.length ? [{ equipmentModel: { in: eqArr } }] : []),
                ...(pnArr.length ? [{ partNumberStr: { in: pnArr } }] : []),
                ...(pnArr.length ? [{ items: { some: { partNumberStr: { in: pnArr } } } }] : []),
              ],
            },
          }
        : { id: -1 }),
    },
    select: { supplierId: true },
  });
  const observedSupplierIds = new Set(observedQuotes.map((q) => q.supplierId));

  const quoteCounts = await prisma.quote.groupBy({
    by: ["supplierId"],
    where: { supplierId: { in: candidateIds }, businessAuthenticity: "REAL" },
    _count: { _all: true },
  });
  const qcMap = new Map(quoteCounts.map((q) => [q.supplierId, q._count._all]));

  const scored: RecommendedSupplier[] = candidates.map((s) => {
    const trustTier: CapabilityTrustTier = trustedSupplierIds.has(s.id)
      ? "TRUSTED"
      : observedSupplierIds.has(s.id)
        ? "OBSERVED"
        : "CLAIMED";
    let score = 0;
    const reasons: string[] = [];
    const mainBrands = s.mainBrands || "";
    const mainEquipment = s.mainEquipment || "";
    const mainBusiness = s.mainBusiness || "";
    const prodText = s.products
      .map((p) => `${p.partNumber?.number || ""} ${p.oemNumber || ""} ${p.name || ""}`)
      .join(" ");

    for (const pn of pnArr) {
      const pnHit = s.products.some(
        (p) => (p.partNumber?.number || "").toUpperCase() === pn.toUpperCase()
          || (p.oemNumber || "").toUpperCase() === pn.toUpperCase()
      );
      if (pnHit) { score += 5; reasons.push(`件号匹配 ${pn}`); }
      else if (prodText.toUpperCase().includes(pn.toUpperCase())) {
        score += 3; reasons.push(`件号相关 ${pn}`);
      }
    }
    for (const nm of nameArr) {
      if (mainBusiness.includes(nm) || prodText.includes(nm)) {
        score += 3; reasons.push(`配件相关 ${nm}`);
      }
    }
    for (const b of brandArr) {
      if (mainBrands.includes(b)) { score += 3; reasons.push(`自述品牌 ${b}`); }
    }
    for (const eq of eqArr) {
      if (mainEquipment.includes(eq)) { score += 2; reasons.push(`自述设备 ${eq}`); }
    }

    if (trustTier === "TRUSTED") reasons.unshift("矿配云可信供货能力");
    else if (trustTier === "OBSERVED") reasons.unshift("存在相关真实报价记录");
    else reasons.unshift("供应声明/候选线索");

    const quoteCount = qcMap.get(s.id) || 0;
    return {
      supplier: s,
      trustTier,
      score,
      reasons: Array.from(new Set(reasons)).slice(0, 4),
      quoteCount,
    };
  });

  scored.sort((a, b) =>
    TRUST_TIER_RANK[b.trustTier] - TRUST_TIER_RANK[a.trustTier]
    || b.score - a.score
    || b.quoteCount - a.quoteCount
    || a.supplier.id - b.supplier.id
  );
  return scored.slice(0, Math.min(limit, scored.length));
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
          data: {
            rfqId,
            supplierId: supplier.id,
            token: genInviteToken(),
            businessAuthenticity: rfq.businessAuthenticity,
          },
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
          businessAuthenticity: rfq.businessAuthenticity,
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
