import type { Prisma } from "@prisma/client";

/**
 * ============================================================
 * V3.1 Stage 3.5B-P0.3 — Canonical Public Product Visibility Rule
 *
 * 公开 Product 必须同时满足：
 *   1. Product.status = PUBLISHED          （Admin 审核通过后的正式发布状态）
 *   2. Product.verificationStatus = VERIFIED （产品级审核通过）
 *   3. Product.partNumber.publishStatus = READY （关联件号已公开）
 *   4. Product.supplier.verifiedStatus = VERIFIED （供应商已认证）
 *   5. Supplier 不存在 DISABLED 用户 （供应商账号未被禁用）
 *
 * ACTIVE 是旧 schema default / legacy 数据，不再作为 public canonical status。
 * 本 helper 是全项目唯一公开 Product 资格定义，避免规则散落。
 * ============================================================
 */

/**
 * 嵌套查询场景使用（从 PartNumber / Equipment 向下 include products 时）。
 * 不含 partNumber.publishStatus 条件，因为父级上下文已保证 READY。
 */
export const PUBLIC_PRODUCT_WHERE_NESTED = {
  status: "PUBLISHED",
  verificationStatus: "VERIFIED",
  supplier: {
    verifiedStatus: "VERIFIED",
    users: { none: { status: "DISABLED" } },
  },
} satisfies Prisma.ProductWhereInput;

/**
 * 直接查询 Product 场景使用。
 * 含 partNumber.publishStatus = READY 条件。
 */
export const PUBLIC_PRODUCT_WHERE = {
  ...PUBLIC_PRODUCT_WHERE_NESTED,
  partNumber: { publishStatus: "READY" },
} satisfies Prisma.ProductWhereInput;
