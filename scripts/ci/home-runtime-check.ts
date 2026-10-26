/**
 * ============================================================
 * 矿配云 V2.0 首页运行时验收 —— HTTP + 数据库状态检查
 *
 * 前提：由 .github/workflows/home-runtime.yml 在构建完成后启动
 *       next start（127.0.0.1:3100）并调用本脚本。
 *
 * 断言口径（KPY-V2-HOME-CI-IMPLEMENTATION-PHASE-A1 §A1-04 / §A1-05）：
 *   - 结构定位锚点全部来自真实源码，不为了测试而修改业务代码：
 *       Banner 区      : <section class="home-banner-strip" aria-label="平台横幅">
 *       件号卡片       : <a class="home-live-card">  （位于 .home-live-grid--3 内）
 *       件号文本       : <strong class="home-live-part-number">{part.number}</strong>
 *       设备适配区     : <section aria-labelledby="fitment-title">
 *       询价区         : <section aria-labelledby="rfq-title">
 *       供应商区       : <section aria-labelledby="supplier-title">
 *     对应样式见 src/app/home.css（.home-banner-strip / .home-live-card /
 *     .home-live-part-number / .home-fitment-row）。
 *   - Banner 图片仅验证 HTML 引用（src/alt），不宣称图片加载成功：
 *     /public 下不存在 /ci-fixture/*.svg，属于纯 CSS/占位素材。
 *   - 数据状态：对全部 22 个 Prisma 模型做整行指纹前后比对，不以 count() 代替。
 *     空表只能证明"没有新增行"，不能证明"没有 UPDATE"，因此最终结论使用
 *     BUSINESS_STATE_UNCHANGED_FOR_CHECKED_MODELS，而不是绝对的"零写入"。
 *   - 任一项失败 => 非零退出码；不输出 DATABASE_URL 或任何凭证。
 * ============================================================
 */

import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/* ------------------------------------------------------------
 * 守卫常量：必须与 scripts/ci/home-runtime-fixture.ts 保持一致。
 * （两个脚本各自独立校验，任一处漂移都会在 CI 中 fail-closed。）
 * ------------------------------------------------------------ */
const CI_DB_NAME = "kuangpeiyun_home_rt";
const CI_DB_HOSTS = ["127.0.0.1", "localhost"];
const CI_DB_PORT = "5432";
const CI_DB_USER = "ci_home_user";
const CI_PG_MAJOR = /^PostgreSQL 16\./;

/* 服务端地址判定：必须与 scripts/ci/home-runtime-fixture.ts 逐字一致（A1-02 / A1-03）。
 * `inet_server_addr()` 是"服务器侧本地 socket 地址"，GitHub Actions 的 services.postgres
 * 为 Docker 容器，服务端看到的是容器 IP（如 172.17.0.x），要求 loopback 会误拒合法 CI 库。
 * 客户端侧 loopback 限制仍由 DATABASE_URL 校验（第 1 层）保证。 */

/**
 * 是否合法的 IP 字面量（IPv4 / IPv6，含 IPv4-mapped 形式）。
 * 只用于确认 `inet_server_addr()` 返回了真实地址，不接受主机名、不做 DNS 解析。
 */
function isValidIpLiteral(value: string): boolean {
  if (!value) return false;

  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(value);
  const candidate = mapped ? mapped[1] : value;

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(candidate)) {
    return candidate.split(".").every((part) => Number(part) <= 255);
  }

  // IPv6：仅结构校验（字符集 + 冒号 + 至多一处 "::" 缩写），足以排除空值与主机名。
  if (candidate.indexOf(":") < 0) return false;
  if (!/^[0-9a-fA-F:]+$/.test(candidate)) return false;
  return candidate.split("::").length - 1 <= 1;
}

/**
 * 地址分类，仅用于审计输出，不参与任何通过/失败判定。
 * 明确：私网地址本身不构成隔离证明。
 */
function classifyAddr(addr: string): "loopback" | "private" | "public" {
  if (addr === "::1" || /^127\./.test(addr)) return "loopback";
  if (/^10\./.test(addr) || /^192\.168\./.test(addr)) return "private";
  const second = /^172\.(\d{1,3})\./.exec(addr);
  if (second && Number(second[1]) >= 16 && Number(second[1]) <= 31) return "private";
  if (/^f[cd][0-9a-f]{2}:/i.test(addr) || /^fe80:/i.test(addr)) return "private";
  return "public";
}

/** 与 fixture 相同的固定参考时刻。 */
const FIXED_NOW = new Date("2026-06-01T00:00:00.000Z");

/** 与 fixture 相同的有效 Banner 窗口（用于判定当前运行日期是否仍在覆盖范围内）。 */
const VALID_WINDOW_START = new Date("2025-01-01T00:00:00.000Z");
const VALID_WINDOW_END = new Date("2030-12-31T00:00:00.000Z");

const P = "CI-FIXTURE";
const BASE_URL = process.env.HOME_RUNTIME_BASE_URL || "http://127.0.0.1:3100";

/** 被快照覆盖的全部 Prisma 模型（22/22）。 */
const SNAPSHOT_MODEL_NAMES = [
  "brand",
  "equipment",
  "category",
  "partNumber",
  "product",
  "supplier",
  "user",
  "buyerCompany",
  "passwordResetToken",
  "favorite",
  "rFQ",
  "quote",
  "rFQItem",
  "quoteItem",
  "rFQInvitation",
  "notification",
  "partNumberRequest",
  "equipmentRequest",
  "banner",
  "partNumberEquipment",
  "partNumberAuditLog",
  "partNumberCrossReference",
] as const;

const failures: string[] = [];
let checks = 0;

function check(name: string, condition: boolean, detail = ""): void {
  checks += 1;
  if (!condition) failures.push(detail ? `${name} — ${detail}` : name);
}

function fatal(name: string, detail: string): never {
  console.error(`CHECK_FATAL: ${name} — ${detail}`);
  process.exit(1);
}

/* ============================================================
 * 第 1 层：环境变量守卫（必要但不充分）
 * ============================================================ */

function requireEnvTarget(): { host: string; port: string; db: string; user: string } {
  const raw = process.env.DATABASE_URL || "";

  if (process.env.CI !== "true") fatal("env guard", "CI env var must be 'true'");
  if (!raw) fatal("env guard", "DATABASE_URL is empty");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fatal("env guard", "DATABASE_URL is not a valid URL");
  }

  if (!/^postgres(ql)?:$/.test(url.protocol)) fatal("env guard", `protocol must be postgresql, got ${url.protocol}`);
  const host = url.hostname;
  if (!CI_DB_HOSTS.includes(host)) fatal("env guard", `host must be loopback, got ${host}`);
  const port = url.port || CI_DB_PORT;
  if (port !== CI_DB_PORT) fatal("env guard", `port must be ${CI_DB_PORT}, got ${port}`);
  const db = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (db !== CI_DB_NAME) fatal("env guard", `database must be ${CI_DB_NAME}, got ${db}`);
  if (/prod|production|staging|live/i.test(db)) fatal("env guard", `production-like database rejected: ${db}`);
  const user = decodeURIComponent(url.username);
  if (user !== CI_DB_USER) fatal("env guard", `user must be ${CI_DB_USER}, got ${user || "(empty)"}`);

  return { host, port, db, user };
}

/* ============================================================
 * 第 2 层：服务端身份校验（真实隔离证明，环境变量不作为唯一依据）
 * ============================================================ */

async function requireServerTarget(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ db: string; addr: string; port: number; ver: string; usr: string }>
  >(
    `SELECT current_database()::text AS db,
            COALESCE(inet_server_addr()::text, '') AS addr,
            COALESCE(inet_server_port(), 0) AS port,
            COALESCE(version(), '') AS ver,
            current_user::text AS usr`,
  );

  const row = rows[0];
  if (!row) fatal("server guard", "identity query returned no rows");

  const db = row.db;
  const addr = row.addr;
  const port = Number(row.port);
  const serverVersion = row.ver.split(" ").slice(0, 2).join(" ");
  const user = row.usr;

  if (db !== CI_DB_NAME) fatal("server guard", `server database is ${db}, expected ${CI_DB_NAME}`);
  // 与 fixture 一致：只要求"非空 + 合法 IP 字面量"，不要求 loopback（Docker service 为容器 IP）。
  // 私网地址本身不构成隔离证明，仅作审计记录。
  if (!addr) {
    fatal("server guard", "server address is empty (unix-socket connection?); a TCP address is required for this guard");
  }
  if (!isValidIpLiteral(addr)) fatal("server guard", `server address is not a valid IP literal: ${addr}`);
  if (port !== Number(CI_DB_PORT)) fatal("server guard", `server port is ${port}, expected ${CI_DB_PORT}`);
  if (!CI_PG_MAJOR.test(row.ver)) fatal("server guard", `server is not PostgreSQL 16 (got "${serverVersion}")`);
  if (user !== CI_DB_USER) fatal("server guard", `current_user is ${user}, expected ${CI_DB_USER}`);

  const tables = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  const publicTables = Number(tables[0]?.count ?? 0);
  if (publicTables === 0) fatal("server guard", "public schema is empty; migrations were expected to have run");

  console.log(
    `CHECK_SERVER_GUARD_PASS db=${db} addr=${addr} addr_class=${classifyAddr(addr)} port=${port} ` +
      `server=${serverVersion} user=${user} tables=${publicTables}`,
  );
}

/* ============================================================
 * 数据状态快照：22 个模型整行指纹
 * ============================================================ */

function modelQueries(prisma: PrismaClient): Record<string, () => Promise<unknown[]>> {
  return {
    brand: () => prisma.brand.findMany({ orderBy: { id: "asc" } }),
    equipment: () => prisma.equipment.findMany({ orderBy: { id: "asc" } }),
    category: () => prisma.category.findMany({ orderBy: { id: "asc" } }),
    partNumber: () => prisma.partNumber.findMany({ orderBy: { id: "asc" } }),
    product: () => prisma.product.findMany({ orderBy: { id: "asc" } }),
    supplier: () => prisma.supplier.findMany({ orderBy: { id: "asc" } }),
    user: () => prisma.user.findMany({ orderBy: { id: "asc" } }),
    buyerCompany: () => prisma.buyerCompany.findMany({ orderBy: { id: "asc" } }),
    passwordResetToken: () => prisma.passwordResetToken.findMany({ orderBy: { id: "asc" } }),
    favorite: () => prisma.favorite.findMany({ orderBy: { id: "asc" } }),
    rFQ: () => prisma.rFQ.findMany({ orderBy: { id: "asc" } }),
    quote: () => prisma.quote.findMany({ orderBy: { id: "asc" } }),
    rFQItem: () => prisma.rFQItem.findMany({ orderBy: { id: "asc" } }),
    quoteItem: () => prisma.quoteItem.findMany({ orderBy: { id: "asc" } }),
    rFQInvitation: () => prisma.rFQInvitation.findMany({ orderBy: { id: "asc" } }),
    notification: () => prisma.notification.findMany({ orderBy: { id: "asc" } }),
    partNumberRequest: () => prisma.partNumberRequest.findMany({ orderBy: { id: "asc" } }),
    equipmentRequest: () => prisma.equipmentRequest.findMany({ orderBy: { id: "asc" } }),
    banner: () => prisma.banner.findMany({ orderBy: { id: "asc" } }),
    partNumberEquipment: () => prisma.partNumberEquipment.findMany({ orderBy: { id: "asc" } }),
    partNumberAuditLog: () => prisma.partNumberAuditLog.findMany({ orderBy: { id: "asc" } }),
    partNumberCrossReference: () => prisma.partNumberCrossReference.findMany({ orderBy: { id: "asc" } }),
  };
}

async function snapshot(prisma: PrismaClient): Promise<Record<string, string>> {
  const queries = modelQueries(prisma);
  const out: Record<string, string> = {};
  for (const name of SNAPSHOT_MODEL_NAMES) {
    const rows = await queries[name]();
    out[name] = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  }
  return out;
}

/* ============================================================
 * HTML 辅助
 * ============================================================ */

function sliceSection(html: string, opener: RegExp): string | null {
  const match = opener.exec(html);
  if (!match || match.index === undefined) return null;
  const end = html.indexOf("</section>", match.index);
  if (end === -1) return null;
  return html.slice(match.index, end);
}

function extractCardBlocks(html: string): string[] {
  // 用 Array.from 而非迭代器展开：tsconfig 未设 target（默认 ES5），展开迭代器需 downlevelIteration。
  return Array.from(html.matchAll(/<a[^>]*class="home-live-card"[^>]*>[\s\S]*?<\/a>/g), (m) => m[0]);
}

async function fetchHome(url: string): Promise<{ status: number; contentType: string; body: string }> {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "text/html" },
    redirect: "manual",
  });
  const body = await response.text();
  return { status: response.status, contentType: response.headers.get("content-type") || "", body };
}

/* ============================================================
 * main
 * ============================================================ */

async function main() {
  const target = requireEnvTarget();
  console.log(`CHECK_ENV_GUARD_PASS host=${target.host} port=${target.port} db=${target.db} user=${target.user}`);
  console.log(`CHECK_BASE_URL ${BASE_URL}/`);

  // 前置条件：fixture 时间窗必须覆盖"当前运行日期"，否则用例结论不可解释。
  const now = new Date();
  if (now.getTime() <= FIXED_NOW.getTime()) {
    fatal("time window precondition", `current date ${now.toISOString()} must be after FIXED_NOW ${FIXED_NOW.toISOString()}`);
  }
  if (now.getTime() < VALID_WINDOW_START.getTime() || now.getTime() > VALID_WINDOW_END.getTime()) {
    fatal(
      "time window precondition",
      `current date ${now.toISOString()} is outside the VALID banner window ` +
        `${VALID_WINDOW_START.toISOString()} ~ ${VALID_WINDOW_END.toISOString()}; update BANNER_SPEC in the fixture`,
    );
  }
  console.log(`CHECK_WINDOW_PRECONDITION_PASS now=${now.toISOString()}`);

  const prisma = new PrismaClient();

  try {
    await requireServerTarget(prisma);

    const before = await snapshot(prisma);

    const first = await fetchHome(`${BASE_URL}/`);
    const second = await fetchHome(`${BASE_URL}/`);

    const after = await snapshot(prisma);

    // ---------- HTTP 层 ----------
    check("first request returns HTTP 200", first.status === 200, `got ${first.status}`);
    check("second request returns HTTP 200", second.status === 200, `got ${second.status}`);
    check("response is HTML", first.contentType.includes("text/html"), `got ${first.contentType}`);
    check("response body is non-trivial", first.body.length > 2000, `length ${first.body.length}`);

    const html = first.body;

    for (const marker of ["Application error", "Internal Server Error", "This page could not be found"]) {
      check(`no error page marker: ${marker}`, !html.includes(marker));
    }
    check("page renders platform brand", html.includes("矿配云"));

    // ---------- 正向件号（锚点：.home-live-part-number） ----------
    check("public part number READY-001 rendered", html.includes(`${P}-PN-READY-001`));
    check("public part number READY-002 rendered", html.includes(`${P}-PN-READY-002`));
    check(
      "part number uses stable card text class",
      html.includes(`class="home-live-part-number">${P}-PN-READY-001`),
      "expected <strong class=\"home-live-part-number\">CI-FIXTURE-PN-READY-001",
    );
    check("part numbers grouped in 3-column live grid", html.includes('class="home-live-grid home-live-grid--3"'));
    check("public brand name rendered", html.includes(`${P} 品牌甲`));
    check("public category rendered", html.includes(`${P} 分类甲`));
    check("active equipment rendered in directory chips", html.includes("CI-FIXTURE-EQ-ALPHA"));
    check("inactive equipment not rendered", !html.includes("CI-FIXTURE-EQ-BETA"));

    // ---------- 有效 Banner（只验证 HTML 引用，不宣称图片加载成功） ----------
    const bannerStrip = sliceSection(html, /<section[^>]*class="home-banner-strip"/);
    check("banner strip section present", bannerStrip !== null, "expected <section class=\"home-banner-strip\">");
    if (bannerStrip) {
      const imgSrcs = Array.from(bannerStrip.matchAll(/<img[^>]+src="([^"]+)"/g), (m) => m[1]);
      check("exactly one banner image referenced", imgSrcs.length === 1, `got ${JSON.stringify(imgSrcs)}`);
      check(
        "referenced banner is the valid fixture (HTML reference only, image file not served)",
        imgSrcs[0] === "/ci-fixture/banner-valid.svg",
        `got ${imgSrcs[0]}`,
      );
      check("banner alt carries the valid fixture title", bannerStrip.includes(`${P}-BANNER-VALID`));
      check(
        "banner links to click endpoint with banner id",
        /href="\/api\/banner\/click\/\d+"/.test(bannerStrip),
        "expected /api/banner/click/<id>",
      );
    }

    // ---------- 负向样本（唯一标识，非泛化词） ----------
    const negativeMarkers = [
      `${P}-PN-HOLD-001`,
      `${P}-PN-UNVERIFIED-001`,
      `${P}-BANNER-EXPIRED`,
      `${P}-BANNER-FUTURE`,
      `${P}-BANNER-WRONG-POSITION`,
      `${P}-BANNER-INACTIVE`,
      `${P}-BANNER-BOUNDARY`,
      `${P}-BANNER-JUST-EXPIRED`,
      "/ci-fixture/banner-expired.svg",
      "/ci-fixture/banner-future.svg",
      "/ci-fixture/banner-wrong-position.svg",
      "/ci-fixture/banner-inactive.svg",
    ];
    for (const marker of negativeMarkers) {
      check(`negative marker absent: ${marker}`, !html.includes(marker));
    }

    // ---------- 件号卡片内不得出现设备适配 / 产品价格 ----------
    const cards = extractCardBlocks(html);
    check("exactly two public part cards rendered", cards.length === 2, `got ${cards.length}`);
    cards.forEach((card, index) => {
      check(`card ${index + 1} has no equipment model`, !/CI-FIXTURE-EQ-/.test(card));
      check(`card ${index + 1} has no fitment wording`, !card.includes("适配"));
      check(
        `card ${index + 1} has no product/price data`,
        !card.includes(`${P}-PRODUCT-UNVERIFIED`) && !card.includes("987654"),
      );
      check(`card ${index + 1} links to part detail`, /href="\/part-number\/ci-fixture-pn-/.test(card));
    });

    // ---------- 设备适配区：只列目录，不下适配结论 ----------
    const fitmentSection = sliceSection(html, /<section[^>]*aria-labelledby="fitment-title"/);
    check("fitment section present", fitmentSection !== null, "expected aria-labelledby=\"fitment-title\"");
    if (fitmentSection) {
      check("fitment section carries no part number", !fitmentSection.includes(`${P}-PN-`));
      check("fitment section keeps disclaimer", fitmentSection.includes("不代表具体件号的适配结论"));
      check("fitment section still renders directory data", fitmentSection.includes("CI-FIXTURE-EQ-ALPHA"));
    }
    check("no fitment claim wording: 适配设备", !html.includes("适配设备"));
    check("no fitment claim wording: 已验证适配", !html.includes("已验证适配"));

    // ---------- 询价区：入口保留、动态列表移除 ----------
    const rfqSection = sliceSection(html, /<section[^>]*aria-labelledby="rfq-title"/);
    check("rfq section present", rfqSection !== null, "expected aria-labelledby=\"rfq-title\"");
    if (rfqSection) {
      check("rfq section has no fixture rfq title", !rfqSection.includes(`${P}-RFQ-TITLE`));
      check("rfq section keeps entry link", rfqSection.includes('href="/rfqs"') && rfqSection.includes('href="/rfq/create"'));
      check("rfq section keeps stopgap copy", rfqSection.includes("首页不再展示动态询价列表"));
    }
    check("rfq fixture title absent from page", !html.includes(`${P}-RFQ-TITLE`));

    // ---------- 供应商区：入口保留、推荐列表移除 ----------
    const supplierSection = sliceSection(html, /<section[^>]*aria-labelledby="supplier-title"/);
    check("supplier section present", supplierSection !== null, "expected aria-labelledby=\"supplier-title\"");
    if (supplierSection) {
      check("supplier section has no unverified supplier", !supplierSection.includes(`${P}-SUPPLIER-PENDING`));
      check("supplier section keeps entry link", supplierSection.includes('href="/suppliers"'));
      check("supplier section keeps stopgap copy", supplierSection.includes("不展示供应商推荐列表"));
    }
    check("unverified supplier absent from page", !html.includes(`${P}-SUPPLIER-PENDING`));

    // ---------- 供应商数量 / 最低价格 ----------
    check("no supplier count wording", !html.includes("家供应商"));
    check("no minimum price wording", !html.includes("最低价"));
    check("no CNY numeric price", !/¥\s*\d/.test(html));
    check("no fixture product price", !html.includes("987654"));
    check("no fixture product name", !html.includes(`${P}-PRODUCT-UNVERIFIED`));

    // ---------- 必要导航入口 ----------
    const requiredHrefs = [
      "/search",
      "/equipment",
      "/brands",
      "/suppliers",
      "/rfq",
      "/rfqs",
      "/rfq/create",
      "/part-number",
      "/login",
      "/register",
      "/about",
      "/contact",
    ];
    for (const href of requiredHrefs) {
      check(`nav href present: ${href}`, html.includes(`href="${href}"`));
    }

    // ---------- 数据状态：22 个模型整行指纹 ----------
    const changed = SNAPSHOT_MODEL_NAMES.filter((name) => before[name] !== after[name]);
    check("all checked model fingerprints unchanged", changed.length === 0, `changed: ${changed.join(", ")}`);

    // ---------- Banner 计数器（显式） ----------
    const banners = await prisma.banner.findMany({
      where: { title: { startsWith: `${P}-BANNER-` } },
      select: { title: true, impressions: true, clicks: true },
      orderBy: { title: "asc" },
    });
    check("fixture banners present", banners.length === 7, `got ${banners.length}`);
    for (const banner of banners) {
      const isLive = banner.title === `${P}-BANNER-VALID`;
      check(
        `banner impressions unchanged: ${banner.title}`,
        banner.impressions === (isLive ? 7 : 0),
        `expected ${isLive ? 7 : 0}, got ${banner.impressions}`,
      );
      check(
        `banner clicks unchanged: ${banner.title}`,
        banner.clicks === (isLive ? 3 : 0),
        `expected ${isLive ? 3 : 0}, got ${banner.clicks}`,
      );
    }

    // ---------- 件号缓存计数（显式） ----------
    const counters = await prisma.partNumber.findMany({
      where: { slug: { startsWith: "ci-fixture-" } },
      select: { number: true, viewCount: true, inquiryCount: true, supplierCount: true, updatedAt: true },
      orderBy: { number: "asc" },
    });
    for (const row of counters) {
      check(
        `part number counters unchanged: ${row.number}`,
        row.viewCount === 0 && row.inquiryCount === 0 && row.supplierCount === 0,
        `view=${row.viewCount} inquiry=${row.inquiryCount} supplier=${row.supplierCount}`,
      );
    }

    // ---------- 汇总 ----------
    if (failures.length > 0) {
      console.error(`CHECK_FAILED ${failures.length}/${checks}`);
      for (const failure of failures) console.error(`  - ${failure}`);
      process.exit(1);
    }
    console.log(`BUSINESS_STATE_UNCHANGED_FOR_CHECKED_MODELS=true models=${SNAPSHOT_MODEL_NAMES.length}`);
    console.log(`CHECKED_MODELS=${SNAPSHOT_MODEL_NAMES.join(",")}`);
    console.log(`CHECK_PASS ${checks}/${checks}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("CHECK_ERROR:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
