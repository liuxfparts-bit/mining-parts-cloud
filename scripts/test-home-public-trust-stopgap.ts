/**
 * 首页公开真实性止血（PUBLIC-TRUST-STOPGAP-V1 + PUBLIC-TRUST-CLOSEOUT-V1）—— 纯静态结构测试
 *
 * 不连接数据库、不启动应用、不发 HTTP、不写盘（仅读取源文件）。
 *
 * 断言四层：
 *   A. 展示层：首页不再渲染件号适配设备列表、动态 RFQ 列表、动态供应商列表，
 *      且不再出现"已核实适配 / 已认证供应商"一类等价文案。
 *   A2. 件号卡片收口：不再展示供应商数量、价格、产品关联，只保留件号/名称/品牌/详情链接。
 *   B. 数据层：首页的 prisma.findMany 调用只允许出现在白名单模型上；
 *      partNumber 查询不得再 include equipmentRelations 或 products；无残留死查询（未使用的 _count）。
 *   C. 边界层：入场链接（/equipment、/rfqs、/rfq/create、/suppliers）必须保留；
 *      /rfqs 与 /suppliers 的公开条件不得被本轮改动。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const home = readFileSync(resolve("src/app/page.tsx"), "utf8");

/** 抽取 prisma.<model>.findMany( ... ) 的实参文本，按花括号配平，避免注释与字符串干扰。 */
function findManyCalls(source: string): Array<{ model: string; args: string }> {
  const calls: Array<{ model: string; args: string }> = [];
  const pattern = /prisma\.([a-zA-Z]+)\.findMany\(\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const start = match.index + match[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = start; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    assert.notEqual(end, -1, `unbalanced braces for prisma.${match[1]}.findMany`);
    calls.push({ model: match[1], args: source.slice(start, end + 1) });
  }
  return calls;
}

// ---------- B. 数据层 ----------
const calls = findManyCalls(home);
assert.ok(calls.length > 0, "home page must still query public directory data");

const ALLOWED_MODELS = new Set(["brand", "equipment", "partNumber", "banner", "category"]);
for (const call of calls) {
  assert.ok(ALLOWED_MODELS.has(call.model), `home page must not query model: ${call.model}`);
}
assert.equal(calls.some((call) => call.model === "supplier"), false, "supplier list query must be removed");
assert.equal(calls.some((call) => call.model === "rFQ"), false, "dynamic RFQ list query must be removed");

const partCalls = calls.filter((call) => call.model === "partNumber");
assert.equal(partCalls.length, 1, "exactly one partNumber query expected");
const partArgs = partCalls[0].args;
assert.ok(partArgs.includes("PUBLIC_PN_WHERE"), "partNumber query must keep PUBLIC_PN_WHERE");
assert.equal(partArgs.includes("equipmentRelations"), false, "partNumber query must not include fitment relations");
// PUBLIC-TRUST-CLOSEOUT-V1：件号卡片不再展示供应商数量与最低价，products 关联已无任何用途
assert.equal(partArgs.includes("products"), false, "partNumber query must not include products after closeout");
assert.equal(
  home.includes("PUBLIC_PRODUCT_WHERE_NESTED"),
  false,
  "public product rule must not be imported by home page after closeout",
);

// 死查询：首页只允许保留被 JSX 实际使用的 _count.partNumbers（品牌"当前公开品牌与件号"）
const counters: string[] = [];
const counterPattern = /_count:\s*\{\s*select:\s*\{\s*([a-zA-Z]+)/g;
let counterMatch: RegExpExecArray | null;
while ((counterMatch = counterPattern.exec(home)) !== null) counters.push(counterMatch[1]);
assert.equal(counters.length, 1, "exactly one ordered counter expected after stopgap");
for (const counter of counters) {
  assert.equal(counter, "partNumbers", `unused counter must be removed: _count.${counter}`);
}

// ---------- A. 展示层 ----------
assert.equal(home.includes("适配设备"), false, "fitment list on part card must be removed");
assert.equal(home.includes("equipmentRelations"), false, "no fitment relation rendering may remain");
assert.equal(home.includes("recentRFQs"), false, "dynamic RFQ list rendering must be removed");
assert.equal(home.includes("suppliers.map"), false, "dynamic supplier list rendering must be removed");
assert.equal(home.includes("最新公开询价"), false, "dynamic RFQ section heading must be removed");

// 等价文案：不得把件号 VERIFIED 说成适配已验证
for (const phrase of ["核实适配", "Verify Fitment", "设备适配验证", "辅助核实选型", "有证据的件号·适配证据"]) {
  assert.equal(home.includes(phrase), false, `verification-claim copy must be removed: ${phrase}`);
}
assert.equal(/Verified Chinese Suppliers/.test(home), false, "must not claim suppliers are verified");
assert.ok(home.includes("不代表具体件号的适配结论"), "fitment disclaimer must be present");

// 未恢复曝光写库
assert.equal(/impressions\s*:\s*\{\s*increment/.test(home), false, "must not increment impressions at render time");
assert.equal(home.includes("banner.updateMany"), false, "must not write banner counters");

// ---------- A2. 件号卡片收口（PUBLIC-TRUST-CLOSEOUT-V1） ----------
// 供应商数量、价格、产品关联均来自未经真实性审核的产品/供应商数据，不得在首页陈述。
for (const phrase of ["家供应商", "¥", "supplierId", "prices", "Math.min", "price"]) {
  assert.equal(home.includes(phrase), false, `part card must not leak unverified product data: ${phrase}`);
}
// 保留的最小陈述面：件号、名称、品牌、详情链接
assert.ok(home.includes("home-live-part-number"), "part number must still be rendered");
assert.ok(home.includes("partNumbers.map"), "part number cards must still be rendered");
assert.ok(home.includes('href={"/part-number/" + part.slug}'), "part detail link must be kept");
assert.ok(home.includes("part.brand?.name"), "brand name must still be rendered");
for (const field of ["part.number", "part.name"]) {
  assert.ok(home.includes(field), `part card must keep ${field}`);
}

// ---------- C. 边界层 ----------
for (const href of ["/equipment", "/rfqs", "/rfq/create", "/suppliers", "/part-number", "/brands", "/search"]) {
  assert.ok(home.includes(`href="${href}"`), `entry link must be kept: ${href}`);
}
assert.ok(home.includes("publicHomeBannerWhere(bannerNow)"), "banner rule must stay centralized");

// 全站公开条件未被本轮改动
const rfqList = readFileSync(resolve("src/app/rfqs/page.tsx"), "utf8");
assert.ok(rfqList.includes('visibility: "PUBLIC"'), "/rfqs public policy must be untouched");
const supplierList = readFileSync(resolve("src/app/suppliers/page.tsx"), "utf8");
assert.ok(supplierList.includes('verifiedStatus: "VERIFIED"'), "/suppliers public policy must be untouched");
const legacyApi = readFileSync(resolve("src/app/api/rfq/route.ts"), "utf8");
assert.ok(legacyApi.includes("410"), "legacy RFQ API must stay disabled");

console.log(
  `PASS: home public-trust stopgap+closeout, ${calls.length} queries on ${new Set(calls.map((c) => c.model)).size} models, ` +
    `0 fitment/RFQ/supplier lists, 0 supplier-count/price/product joins, ${counters.length} counters, entries kept, no database access`,
);
