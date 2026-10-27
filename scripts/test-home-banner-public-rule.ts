/**
 * 首页 banner 公开规则 —— 纯模拟测试（不连接数据库、不启动应用、不写盘）
 *
 * 覆盖两层：
 *   A. 规则层：把 publicHomeBannerWhere(now) 产出的 Prisma where 对象，用内存求值器
 *      套在固定的 banner 样本上，逐条断言"该不该出现在首页顶部横幅位"。
 *   B. 接线层：静态断言 page.tsx 确实使用该唯一真相条件，且未恢复渲染期曝光写库。
 *
 * 说明：求值器只实现本仓库实际用到的 where 子集（标量相等、null、lte/gte、AND/OR），
 * 属模拟语义，不等于真实 SQL 执行结果；真实数据库验证需独立的隔离测试库阶段。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PUBLIC_HOME_BANNER_POSITION, publicHomeBannerWhere } from "../src/lib/home-banner";

type Row = Record<string, unknown>;
type Where = Record<string, any>;

function matchLeaf(row: Row, field: string, condition: unknown): boolean {
  const value = row[field];
  if (condition === null) return value === null || value === undefined;
  if (condition instanceof Date) return value instanceof Date && value.getTime() === condition.getTime();
  if (typeof condition === "object" && condition !== null) {
    const map = condition as Record<string, Date>;
    if ("lte" in map) return value instanceof Date && value.getTime() <= map.lte.getTime();
    if ("gte" in map) return value instanceof Date && value.getTime() >= map.gte.getTime();
    throw new Error(`unsupported operator on ${field}`);
  }
  return value === condition;
}

function matchWhere(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return (condition as Where[]).every((sub) => matchWhere(row, sub));
    if (key === "OR") return (condition as Where[]).some((sub) => matchWhere(row, sub));
    return matchLeaf(row, key, condition);
  });
}

const NOW = new Date("2026-10-26T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const at = (offsetHours: number) => new Date(NOW.getTime() + offsetHours * HOUR);

const base = {
  status: "ACTIVE",
  position: PUBLIC_HOME_BANNER_POSITION,
  startAt: null as Date | null,
  endAt: null as Date | null,
};

const cases: Array<[string, Row, boolean]> = [
  ["无时间窗 HOME_TOP", { ...base }, true],
  ["在期内", { ...base, startAt: at(-24), endAt: at(24) }, true],
  ["startAt 恰为 now（闭区间）", { ...base, startAt: at(0) }, true],
  ["endAt 恰为 now（闭区间）", { ...base, endAt: at(0) }, true],
  ["已过期", { ...base, startAt: at(-48), endAt: at(-1) }, false],
  ["未开始", { ...base, startAt: at(1), endAt: at(48) }, false],
  ["仅 endAt 且已过期", { ...base, endAt: at(-1) }, false],
  ["仅 startAt 且未开始", { ...base, startAt: at(1) }, false],
  ["status=PAUSED", { ...base, status: "PAUSED" }, false],
  ["status=DELETED 且 position 正确", { ...base, status: "DELETED" }, false],
  ["position=HOME_RECOMMEND", { ...base, position: "HOME_RECOMMEND" }, false],
  ["position=HOME_MIDDLE", { ...base, position: "HOME_MIDDLE" }, false],
  ["position=HOME_BOTTOM", { ...base, position: "HOME_BOTTOM" }, false],
  ["position 为任意其他值", { ...base, position: "SIDEBAR" }, false],
  ["position 缺失（历史数据）", { ...base, position: undefined }, false],
  ["position 小写（无约束 String 字段）", { ...base, position: "home_top" }, false],
];

const where = publicHomeBannerWhere(NOW);

assert.equal(where.status, "ACTIVE", "must filter status=ACTIVE");
assert.equal(where.position, PUBLIC_HOME_BANNER_POSITION, "must filter position=HOME_TOP");
assert.ok(Array.isArray(where.AND) && where.AND.length === 2, "must carry both time-window branches");

let checked = 0;
for (const [name, row, expected] of cases) {
  assert.equal(matchWhere(row, where), expected, `case failed: ${name}`);
  checked++;
}

// 接线层：唯一真相 + 未恢复写库
const page = readFileSync(resolve("src/app/page.tsx"), "utf8");
assert.match(page, /publicHomeBannerWhere\(bannerNow\)/, "home page must use the canonical banner rule");
assert.doesNotMatch(page, /impressions\s*:\s*\{\s*increment/, "page must not increment impressions at render time");
assert.doesNotMatch(page, /banner\.updateMany/, "page must not write banner counters");
assert.doesNotMatch(page, /position:\s*"HOME_TOP"[\s\S]{0,200}status:\s*"ACTIVE"/, "page must not duplicate the banner rule inline");

console.log(`PASS: home banner public rule, ${checked} banner fixtures, no database access`);
