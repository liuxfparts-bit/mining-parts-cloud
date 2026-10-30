import type { Prisma } from "@prisma/client";

/**
 * ============================================================
 * V2.0 Home — Canonical Public Banner Visibility Rule
 *
 * 首页横幅位（home-banner-strip）公开可见必须同时满足：
 *   1. Banner.status = ACTIVE                （仅启用投放）
 *   2. Banner.position = HOME_TOP            （仅首页顶部投放位）
 *   3. startAt 为空 或 startAt <= now         （投放未开始则不展示）
 *   4. endAt   为空 或 endAt   >= now         （投放已结束则不展示）
 *
 * 时间窗判定与 /api/banner/click/[id] 保持一致，避免"能点开但没展示"或
 * "展示中却已过期"的不一致状态。
 *
 * position 在 schema 中为 String（非枚举），后台可选值为
 * HOME_TOP / HOME_RECOMMEND / HOME_MIDDLE / HOME_BOTTOM（见 admin/banners）。
 * 首页顶部横幅位只对应 HOME_TOP；其余投放位不应出现在该区域。
 *
 * 本 helper 是首页 banner 公开资格的唯一真相，禁止在页面内另写一份条件。
 * 本模块只做条件构造，不读写数据库，可被纯模拟测试直接覆盖。
 * ============================================================
 */

/** 首页顶部横幅位标识（与 admin/banners 的 POS 选项一致）。 */
export const PUBLIC_HOME_BANNER_POSITION = "HOME_TOP" as const;

/** 构造首页 banner 的公开查询条件（now 由调用方传入，避免隐式时钟依赖）。 */
export function publicHomeBannerWhere(now: Date) {
  return {
    status: "ACTIVE",
    position: PUBLIC_HOME_BANNER_POSITION,
    AND: [
      { OR: [{ startAt: null }, { startAt: { lte: now } }] },
      { OR: [{ endAt: null }, { endAt: { gte: now } }] },
    ],
  } satisfies Prisma.BannerWhereInput;
}
