/**
 * ============================================================
 * 矿配云 V2.0 首页运行时验收 —— CI Fixtures（插入专用）
 *
 * 用途：在一个一次性 PostgreSQL 16 service 容器里准备首页验收所需的最小正/负样本。
 *
 * 硬性约束（KPY-V2-HOME-CI-IMPLEMENTATION-PHASE-A1 §A1-02 / §A1-03）：
 *   1. 三层守卫：环境变量层 → 服务端身份层 → 空库/已迁移层。
 *      环境变量不作为唯一安全证明，服务端 `current_database() / inet_server_addr() /
 *      inet_server_port() / version() / current_user` 才构成服务端侧的身份证明。
 *      注意 `inet_server_addr()` 的语义是"服务器侧本地 socket 地址"，不是客户端来源地址：
 *      GitHub Actions 的 services.postgres 是 Docker 容器，端口映射到 runner 的
 *      127.0.0.1:5432，但服务端看到的是容器自身 IP（如 172.17.0.x）。因此该地址
 *      只要求"非空且为合法 IP 字面量"，不再要求等于 loopback；客户端侧的 loopback
 *      限制仍由 DATABASE_URL 校验（第 1 层）保证。私网地址本身不构成隔离证明。
 *   2. 任何写入前必须先通过身份校验；`KPY_GUARD_ONLY=1` 时只做校验、不做写入，
 *      供迁移（migrate deploy）之前的 gate 使用。
 *   3. 只用 Prisma Client create，禁止 deleteMany / truncate / drop / 破坏性 raw SQL。
 *   4. 不调用项目通用 seed（prisma/seed.ts 含 7 表 deleteMany）。
 *   5. 幂等语义：全部存在 → 校验通过后跳过；全部不存在 → 创建；
 *      部分存在/字段不符 → 立即失败（不清理、不覆盖、不重建）。
 *   6. 样本不含真实客户、供应商、手机号或邮箱。
 *   7. 时间窗使用固定且有限的区间（见 BANNER_SPEC 注释），不依赖 CI 时钟恰好等于边界。
 *
 * 全部样本使用 CI-FIXTURE 前缀，便于审计"测试数据未进生产"。
 * ============================================================
 */

import { PrismaClient } from "@prisma/client";
import { publicHomeBannerWhere } from "../../src/lib/home-banner";

const CI_DB_NAME = "kuangpeiyun_home_rt";
const CI_DB_HOSTS = ["127.0.0.1", "localhost"];
const CI_DB_PORT = "5432";
const CI_DB_USER = "ci_home_user";
const CI_PG_MAJOR = /^PostgreSQL 16\./;

/**
 * 是否合法的 IP 字面量（IPv4 / IPv6，含 IPv4-mapped 形式），可带 CIDR 前缀长度。
 *
 * 必须接受 "地址/前缀长度"：`COALESCE(inet_server_addr()::text, '')` 返回的是 PostgreSQL
 * inet 的文本表示，实测为 `172.18.0.2/32`（Prisma 版本库中 `::text` 会保留前缀长度）。
 * 前缀长度只做严格的数值范围校验（IPv4 ≤ 32 / IPv6 ≤ 128），不参与任何隔离判定。
 *
 * 只用于确认 `inet_server_addr()` 返回了真实地址，不接受主机名、不做 DNS 解析。
 */
function isValidIpLiteral(value: string): boolean {
  if (!value) return false;
  // 拒绝前后空白：避免 " 172.18.0.2" 这类被上层拼接污染的值蒙混通过。
  if (value.trim() !== value) return false;

  const slash = value.indexOf("/");
  const hostPart = slash < 0 ? value : value.slice(0, slash);
  const prefixPart = slash < 0 ? null : value.slice(slash + 1);

  // 前缀长度：纯十进制且无前导零；空串（"172.18.0.2/"）、负号、小数、字母一律拒绝。
  if (prefixPart !== null) {
    if (!/^\d{1,3}$/.test(prefixPart)) return false;
    if (prefixPart.length > 1 && prefixPart.startsWith("0")) return false;
  }

  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(hostPart);
  const candidate = mapped ? mapped[1] : hostPart;

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(candidate)) {
    if (!candidate.split(".").every((part) => Number(part) <= 255)) return false;
    // IPv4-mapped 形式按 IPv6 语义取上限 128，普通 IPv4 取 32。
    return prefixPart === null || Number(prefixPart) <= (mapped ? 128 : 32);
  }

  // IPv6：仅结构校验（字符集 + 冒号 + 至多一处 "::" 缩写），足以排除空值与主机名。
  if (candidate.indexOf(":") < 0) return false;
  if (!/^[0-9a-fA-F:]+$/.test(candidate)) return false;
  if (candidate.split("::").length - 1 > 1) return false;
  return prefixPart === null || Number(prefixPart) <= 128;
}

/**
 * 地址分类，仅用于审计输出，不参与任何通过/失败判定。
 * 明确：私网地址本身不构成隔离证明。
 */
function classifyAddr(addr: string): "loopback" | "private" | "public" {
  // 地址可能带 CIDR 前缀（如 172.18.0.2/32），分类只看地址部分。
  const host = addr.indexOf("/") >= 0 ? addr.slice(0, addr.indexOf("/")) : addr;
  if (host === "::1" || /^127\./.test(host)) return "loopback";
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return "private";
  const second = /^172\.(\d{1,3})\./.exec(host);
  if (second && Number(second[1]) >= 16 && Number(second[1]) <= 31) return "private";
  if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return "private";
  return "public";
}

/** 固定参考时刻：所有时间窗断言以它为准，与 CI 实际执行时钟解耦。 */
const FIXED_NOW = new Date("2026-06-01T00:00:00.000Z");

/** 标记前缀：所有 fixture 记录统一使用。 */
const P = "CI-FIXTURE";

/* ------------------------------------------------------------
 * 时间窗设计（A1-01）
 *
 * 有效范围核对：
 *   - PostgreSQL timestamptz：公元前 4713 年 ~ 公元 294276 年
 *   - JavaScript Date      ：±275760-09-13（毫秒±8.64e15）
 *   原 2999 年窗口在两端都合法，但属于无必要的远期值：一旦出现"过期判断失效"的
 *   真实缺陷，2999 年窗口会让用例继续通过，掩盖问题。因此改为有限的固定区间：
 *     有效 Banner ：2025-01-01 ~ 2030-12-31（覆盖当前运行日期，且边界明确）
 *     未来 Banner ：2035-01-01 ~ 2036-12-31
 *     过期 Banner ：2019-01-01 ~ 2020-12-31
 *   并在 check 脚本中断言"当前运行日期确实落在有效窗口内"，窗口过期时明确报错，
 *   而不是静默失败或静默通过。
 * ------------------------------------------------------------ */

type BannerSpec = {
  title: string;
  imageUrl: string;
  position: string;
  status: string;
  startAt: Date;
  endAt: Date;
  sortOrder: number;
  impressions: number;
  clicks: number;
};

const BANNER_SPEC: BannerSpec[] = [
  {
    title: `${P}-BANNER-VALID`,
    imageUrl: "/ci-fixture/banner-valid.svg",
    position: "HOME_TOP",
    status: "ACTIVE",
    startAt: new Date("2025-01-01T00:00:00.000Z"),
    endAt: new Date("2030-12-31T00:00:00.000Z"),
    sortOrder: 1,
    impressions: 7,
    clicks: 3,
  },
  {
    title: `${P}-BANNER-EXPIRED`,
    imageUrl: "/ci-fixture/banner-expired.svg",
    position: "HOME_TOP",
    status: "ACTIVE",
    startAt: new Date("2019-01-01T00:00:00.000Z"),
    endAt: new Date("2020-12-31T00:00:00.000Z"),
    sortOrder: 2,
    impressions: 0,
    clicks: 0,
  },
  {
    title: `${P}-BANNER-FUTURE`,
    imageUrl: "/ci-fixture/banner-future.svg",
    position: "HOME_TOP",
    status: "ACTIVE",
    startAt: new Date("2035-01-01T00:00:00.000Z"),
    endAt: new Date("2036-12-31T00:00:00.000Z"),
    sortOrder: 3,
    impressions: 0,
    clicks: 0,
  },
  {
    title: `${P}-BANNER-WRONG-POSITION`,
    imageUrl: "/ci-fixture/banner-wrong-position.svg",
    position: "HOME_RECOMMEND",
    status: "ACTIVE",
    startAt: new Date("2025-01-01T00:00:00.000Z"),
    endAt: new Date("2030-12-31T00:00:00.000Z"),
    sortOrder: 4,
    impressions: 0,
    clicks: 0,
  },
  {
    title: `${P}-BANNER-INACTIVE`,
    imageUrl: "/ci-fixture/banner-inactive.svg",
    position: "HOME_TOP",
    status: "INACTIVE",
    startAt: new Date("2025-01-01T00:00:00.000Z"),
    endAt: new Date("2030-12-31T00:00:00.000Z"),
    sortOrder: 5,
    impressions: 0,
    clicks: 0,
  },
  {
    // 边界：startAt === endAt === FIXED_NOW，lte / gte 含端点 => 在 FIXED_NOW 必须命中。
    // 该记录在真实运行日期（晚于 FIXED_NOW）必然不命中，因此不会污染首页 DOM。
    title: `${P}-BANNER-BOUNDARY`,
    imageUrl: "/ci-fixture/banner-boundary.svg",
    position: "HOME_TOP",
    status: "ACTIVE",
    startAt: FIXED_NOW,
    endAt: FIXED_NOW,
    sortOrder: 6,
    impressions: 0,
    clicks: 0,
  },
  {
    // 边界：endAt = FIXED_NOW - 1ms => 在 FIXED_NOW 必须被排除。
    title: `${P}-BANNER-JUST-EXPIRED`,
    imageUrl: "/ci-fixture/banner-just-expired.svg",
    position: "HOME_TOP",
    status: "ACTIVE",
    startAt: new Date("2025-01-01T00:00:00.000Z"),
    endAt: new Date(FIXED_NOW.getTime() - 1),
    sortOrder: 7,
    impressions: 0,
    clicks: 0,
  },
];

const BRAND_SPEC = [
  { slug: "ci-fixture-brand-alpha", name: `${P} 品牌甲`, nameEn: `${P} Brand Alpha`, status: "ACTIVE" },
  { slug: "ci-fixture-brand-beta", name: `${P} 品牌乙`, nameEn: `${P} Brand Beta`, status: "INACTIVE" },
];

const EQUIPMENT_SPEC = [
  {
    slug: "ci-fixture-eq-alpha",
    brandSlug: "ci-fixture-brand-alpha",
    model: "CI-FIXTURE-EQ-ALPHA",
    name: `${P} 设备甲`,
    equipmentType: "TEST",
    status: "ACTIVE",
  },
  {
    slug: "ci-fixture-eq-beta",
    brandSlug: "ci-fixture-brand-alpha",
    model: "CI-FIXTURE-EQ-BETA",
    name: `${P} 设备乙（停用）`,
    equipmentType: "TEST",
    status: "INACTIVE",
  },
];

const CATEGORY_SPEC = [{ slug: "ci-fixture-category-alpha", name: `${P} 分类甲`, sortOrder: 1 }];

/** 件号样本类型：显式收窄到 Prisma 枚举的字面量联合，避免 string 宽化后无法写入。 */
type PartNumberSpec = {
  number: string;
  slug: string;
  name: string;
  verificationStatus: "VERIFIED" | "UNVERIFIED";
  publishStatus: "READY" | "HOLD" | "HIDDEN";
  verified: boolean;
};

const PART_NUMBER_SPEC: PartNumberSpec[] = [
  {
    number: `${P}-PN-READY-001`,
    slug: "ci-fixture-pn-ready-001",
    name: `${P} 件号甲（已核验）`,
    verificationStatus: "VERIFIED",
    publishStatus: "READY",
    verified: true,
  },
  {
    number: `${P}-PN-READY-002`,
    slug: "ci-fixture-pn-ready-002",
    name: `${P} 件号乙（已核验）`,
    verificationStatus: "VERIFIED",
    publishStatus: "READY",
    verified: true,
  },
  {
    number: `${P}-PN-HOLD-001`,
    slug: "ci-fixture-pn-hold-001",
    name: `${P} 件号丙（HOLD 不应展示）`,
    verificationStatus: "VERIFIED",
    publishStatus: "HOLD",
    verified: true,
  },
  {
    number: `${P}-PN-UNVERIFIED-001`,
    slug: "ci-fixture-pn-unverified-001",
    name: `${P} 件号丁（未验证不应展示）`,
    verificationStatus: "UNVERIFIED",
    publishStatus: "READY",
    verified: false,
  },
];

const SUPPLIER_SPEC = [
  {
    slug: "ci-fixture-supplier-pending",
    name: `${P}-SUPPLIER-PENDING`,
    shortName: `${P} 供应商`,
    mainBusiness: `${P} 测试主营业务`,
    verifiedStatus: "PENDING",
    memberLevel: "FREE",
  },
];

const PRODUCT_SPEC = {
  name: `${P}-PRODUCT-UNVERIFIED`,
  price: 987654.32,
  currency: "CNY",
  status: "ACTIVE",
  verificationStatus: "UNVERIFIED",
  partNumberNumber: `${P}-PN-READY-001`,
  supplierSlug: "ci-fixture-supplier-pending",
};

/** 关系样本类型：同样收窄到 Prisma 枚举字面量。 */
type RelationSpec = {
  partNumberNumber: string;
  equipmentModel: string;
  evidenceStatus: "EXPLICIT";
  verificationStatus: "VERIFIED";
  evidenceSummary: string;
};

const RELATION_SPEC: RelationSpec = {
  partNumberNumber: `${P}-PN-READY-001`,
  equipmentModel: "CI-FIXTURE-EQ-ALPHA",
  evidenceStatus: "EXPLICIT",
  verificationStatus: "VERIFIED",
  evidenceSummary: `${P} 关系样例（仅用于验证首页不展示适配结论）`,
};

const RFQ_SPEC = {
  title: `${P}-RFQ-TITLE`,
  description: `${P} 测试询价描述（不应出现在首页）`,
  contactName: `${P}-CONTACT`,
  contactPhone: "000-0000-0000",
  visibility: "PUBLIC",
  status: "COLLECTING",
  quantity: 1,
  unit: "pcs",
};

/* ============================================================
 * 第 1 层：环境变量守卫（必要但不充分）
 * ============================================================ */

function requireEnvTarget(): { host: string; port: string; db: string; user: string } {
  const raw = process.env.DATABASE_URL || "";
  const fail = (msg: string): never => {
    console.error(`GUARD_ENV_FAIL: ${msg}`);
    process.exit(1);
  };

  if (process.env.CI !== "true") fail("CI env var must be 'true' (refuse to run outside CI)");
  if (!raw) fail("DATABASE_URL is empty");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("DATABASE_URL is not a valid URL");
  }

  if (!/^postgres(ql)?:$/.test(url.protocol)) fail(`protocol must be postgresql, got ${url.protocol}`);
  const host = url.hostname;
  if (!CI_DB_HOSTS.includes(host)) fail(`host must be loopback, got ${host}`);
  const port = url.port || CI_DB_PORT;
  if (port !== CI_DB_PORT) fail(`port must be ${CI_DB_PORT}, got ${port}`);
  const db = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (db !== CI_DB_NAME) fail(`database must be ${CI_DB_NAME}, got ${db}`);
  if (/prod|production|staging|live/i.test(db)) fail(`production-like database rejected: ${db}`);
  const user = decodeURIComponent(url.username);
  if (user !== CI_DB_USER) fail(`user must be ${CI_DB_USER}, got ${user || "(empty)"}`);

  return { host, port, db, user };
}

/* ============================================================
 * 第 2/3 层：服务端身份 + 数据库状态（真实隔离证明）
 * ============================================================ */

type ServerIdentity = {
  db: string;
  addr: string;
  port: number;
  serverVersion: string;
  user: string;
  publicTables: number;
};

async function readServerIdentity(prisma: PrismaClient): Promise<ServerIdentity> {
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
  if (!row) {
    console.error("GUARD_SERVER_FAIL: identity query returned no rows");
    process.exit(1);
  }

  const tables = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`,
  );

  return {
    db: row.db,
    addr: row.addr,
    port: Number(row.port),
    serverVersion: row.ver,
    user: row.usr,
    publicTables: Number(tables[0]?.count ?? 0),
  };
}

async function requireServerTarget(prisma: PrismaClient, expectMigrated: boolean): Promise<ServerIdentity> {
  const identity = await readServerIdentity(prisma);
  const fail = (msg: string): never => {
    console.error(`GUARD_SERVER_FAIL: ${msg}`);
    process.exit(1);
  };

  if (identity.db !== CI_DB_NAME) fail(`server database is ${identity.db}, expected ${CI_DB_NAME}`);
  // 服务端地址：只要求"非空 + 合法 IP 字面量"。
  // 不要求等于 loopback —— Docker service 的服务器侧地址是容器 IP，强制 loopback 会误拒合法 CI 数据库。
  // 也不把任意私网地址当作隔离证明：隔离由 库名 + 账号 + 端口 + PG 主版本 + 迁移前空 schema
  // + 随 runner 销毁的临时容器 共同证明，地址仅作审计记录。
  if (!identity.addr) {
    fail("server address is empty (unix-socket connection?); a TCP address is required for this guard");
  }
  if (!isValidIpLiteral(identity.addr)) fail(`server address is not a valid IP literal: ${identity.addr}`);
  if (identity.port !== Number(CI_DB_PORT)) fail(`server port is ${identity.port}, expected ${CI_DB_PORT}`);
  if (!CI_PG_MAJOR.test(identity.serverVersion)) {
    fail(`server is not PostgreSQL 16 (version prefix "${identity.serverVersion.split(" ").slice(0, 2).join(" ")}")`);
  }
  if (identity.user !== CI_DB_USER) fail(`current_user is ${identity.user}, expected ${CI_DB_USER}`);
  if (expectMigrated && identity.publicTables === 0) fail("public schema is empty but migrations were expected");
  if (!expectMigrated && identity.publicTables !== 0) {
    fail(`public schema already has ${identity.publicTables} tables; expected a fresh empty database before migration`);
  }

  // 仅输出隔离标识，不输出密码、连接串或敏感环境变量。
  // addr 已按 A1-02 降级为审计信息（addr_class 只是分类标签，不作为隔离证明）。
  console.log(
    `GUARD_SERVER_PASS db=${identity.db} addr=${identity.addr} addr_class=${classifyAddr(identity.addr)} ` +
      `port=${identity.port} server=${identity.serverVersion.split(" ").slice(0, 2).join(" ")} ` +
      `user=${identity.user} tables=${identity.publicTables}`,
  );
  return identity;
}

/* ============================================================
 * 第 4 层：Fixture 完整性判定（A1-03）
 * ============================================================ */

type FixtureState = "EMPTY" | "COMPLETE" | "PARTIAL";

type Inspection = { state: FixtureState; total: number; issues: string[] };

async function inspectFixture(prisma: PrismaClient): Promise<Inspection> {
  const [brands, equipment, categories, partNumbers, suppliers, products, relations, rfqs, banners] =
    await Promise.all([
      prisma.brand.findMany({ where: { slug: { startsWith: "ci-fixture-" } } }),
      prisma.equipment.findMany({ where: { slug: { startsWith: "ci-fixture-" } } }),
      prisma.category.findMany({ where: { slug: { startsWith: "ci-fixture-" } } }),
      prisma.partNumber.findMany({ where: { slug: { startsWith: "ci-fixture-" } } }),
      prisma.supplier.findMany({ where: { slug: { startsWith: "ci-fixture-" } } }),
      prisma.product.findMany({ where: { name: PRODUCT_SPEC.name } }),
      prisma.partNumberEquipment.findMany({ where: { evidenceSummary: { startsWith: P } } }),
      prisma.rFQ.findMany({ where: { title: RFQ_SPEC.title } }),
      prisma.banner.findMany({ where: { title: { startsWith: `${P}-BANNER-` } } }),
    ]);

  const total =
    brands.length +
    equipment.length +
    categories.length +
    partNumbers.length +
    suppliers.length +
    products.length +
    relations.length +
    rfqs.length +
    banners.length;

  if (total === 0) return { state: "EMPTY", total, issues: [] };

  const issues: string[] = [];
  const issue = (msg: string) => issues.push(msg);

  // --- Brand ---
  if (brands.length !== BRAND_SPEC.length) issue(`brand count ${brands.length} != ${BRAND_SPEC.length}`);
  const brandBySlug = new Map(brands.map((row) => [row.slug, row]));
  for (const spec of BRAND_SPEC) {
    const row = brandBySlug.get(spec.slug);
    if (!row) issue(`brand missing: ${spec.slug}`);
    else if (row.name !== spec.name || row.status !== spec.status) issue(`brand mismatch: ${spec.slug}`);
  }

  // --- Equipment ---
  if (equipment.length !== EQUIPMENT_SPEC.length) issue(`equipment count ${equipment.length} != ${EQUIPMENT_SPEC.length}`);
  const equipmentByModel = new Map(equipment.map((row) => [row.model, row]));
  for (const spec of EQUIPMENT_SPEC) {
    const row = equipmentByModel.get(spec.model);
    if (!row) issue(`equipment missing: ${spec.model}`);
    else {
      if (row.slug !== spec.slug || row.status !== spec.status || row.name !== spec.name) {
        issue(`equipment mismatch: ${spec.model}`);
      }
      const brand = brandBySlug.get(spec.brandSlug);
      if (!brand || row.brandId !== brand.id) issue(`equipment brand link mismatch: ${spec.model}`);
    }
  }

  // --- Category ---
  if (categories.length !== CATEGORY_SPEC.length) issue(`category count ${categories.length} != ${CATEGORY_SPEC.length}`);
  for (const spec of CATEGORY_SPEC) {
    const row = categories.find((item) => item.slug === spec.slug);
    if (!row) issue(`category missing: ${spec.slug}`);
    else if (row.name !== spec.name) issue(`category mismatch: ${spec.slug}`);
  }

  // --- PartNumber ---
  if (partNumbers.length !== PART_NUMBER_SPEC.length) {
    issue(`partNumber count ${partNumbers.length} != ${PART_NUMBER_SPEC.length}`);
  }
  const pnByNumber = new Map(partNumbers.map((row) => [row.number, row]));
  for (const spec of PART_NUMBER_SPEC) {
    const row = pnByNumber.get(spec.number);
    if (!row) issue(`partNumber missing: ${spec.number}`);
    else if (
      row.slug !== spec.slug ||
      row.name !== spec.name ||
      row.verificationStatus !== spec.verificationStatus ||
      row.publishStatus !== spec.publishStatus ||
      row.verified !== spec.verified
    ) {
      issue(`partNumber mismatch: ${spec.number}`);
    }
  }

  // --- Supplier ---
  if (suppliers.length !== SUPPLIER_SPEC.length) issue(`supplier count ${suppliers.length} != ${SUPPLIER_SPEC.length}`);
  for (const spec of SUPPLIER_SPEC) {
    const row = suppliers.find((item) => item.slug === spec.slug);
    if (!row) issue(`supplier missing: ${spec.slug}`);
    else if (row.name !== spec.name || row.verifiedStatus !== spec.verifiedStatus) {
      issue(`supplier mismatch: ${spec.slug}`);
    }
  }

  // --- Product（含关系） ---
  if (products.length !== 1) issue(`product count ${products.length} != 1`);
  if (products.length === 1) {
    const row = products[0];
    const pn = pnByNumber.get(PRODUCT_SPEC.partNumberNumber);
    const supplier = suppliers.find((item) => item.slug === PRODUCT_SPEC.supplierSlug);
    if (row.verificationStatus !== PRODUCT_SPEC.verificationStatus) issue("product verificationStatus mismatch");
    if (row.status !== PRODUCT_SPEC.status) issue("product status mismatch");
    if (row.price !== PRODUCT_SPEC.price) issue(`product price mismatch: ${row.price}`);
    if (!pn || row.partNumberId !== pn.id) issue("product partNumber link mismatch");
    if (!supplier || row.supplierId !== supplier.id) issue("product supplier link mismatch");
  }

  // --- PartNumberEquipment ---
  if (relations.length !== 1) issue(`relation count ${relations.length} != 1`);
  if (relations.length === 1) {
    const row = relations[0];
    const pn = pnByNumber.get(RELATION_SPEC.partNumberNumber);
    const eq = equipmentByModel.get(RELATION_SPEC.equipmentModel);
    if (row.verificationStatus !== RELATION_SPEC.verificationStatus) issue("relation verificationStatus mismatch");
    if (row.evidenceStatus !== RELATION_SPEC.evidenceStatus) issue("relation evidenceStatus mismatch");
    if (!pn || row.partNumberId !== pn.id) issue("relation partNumber link mismatch");
    if (!eq || row.equipmentModelId !== eq.id) issue("relation equipment link mismatch");
  }

  // --- RFQ ---
  if (rfqs.length !== 1) issue(`rfq count ${rfqs.length} != 1`);
  if (rfqs.length === 1) {
    const row = rfqs[0];
    const pn = pnByNumber.get(RELATION_SPEC.partNumberNumber);
    const eq = equipmentByModel.get(RELATION_SPEC.equipmentModel);
    const brand = brandBySlug.get(EQUIPMENT_SPEC[0].brandSlug);
    if (row.visibility !== RFQ_SPEC.visibility || row.status !== RFQ_SPEC.status) issue("rfq visibility/status mismatch");
    if (row.contactPhone !== RFQ_SPEC.contactPhone) issue("rfq contactPhone mismatch");
    if (!pn || row.partNumberId !== pn.id) issue("rfq partNumber link mismatch");
    if (!eq || row.equipmentId !== eq.id) issue("rfq equipment link mismatch");
    if (!brand || row.brandId !== brand.id) issue("rfq brand link mismatch");
  }

  // --- Banner（含时间窗字段） ---
  if (banners.length !== BANNER_SPEC.length) issue(`banner count ${banners.length} != ${BANNER_SPEC.length}`);
  for (const spec of BANNER_SPEC) {
    const row = banners.find((item) => item.title === spec.title);
    if (!row) {
      issue(`banner missing: ${spec.title}`);
      continue;
    }
    if (row.imageUrl !== spec.imageUrl) issue(`banner imageUrl mismatch: ${spec.title}`);
    if (row.position !== spec.position) issue(`banner position mismatch: ${spec.title}`);
    if (row.status !== spec.status) issue(`banner status mismatch: ${spec.title}`);
    if ((row.startAt?.getTime() ?? -1) !== spec.startAt.getTime()) issue(`banner startAt mismatch: ${spec.title}`);
    if ((row.endAt?.getTime() ?? -1) !== spec.endAt.getTime()) issue(`banner endAt mismatch: ${spec.title}`);
    if (row.impressions !== spec.impressions || row.clicks !== spec.clicks) {
      issue(`banner counters modified: ${spec.title} (impressions=${row.impressions}, clicks=${row.clicks})`);
    }
  }

  return { state: issues.length === 0 ? "COMPLETE" : "PARTIAL", total, issues };
}

/* ============================================================
 * 创建
 * ============================================================ */

async function createFixture(prisma: PrismaClient): Promise<void> {
  const brandIds = new Map<string, number>();
  for (const spec of BRAND_SPEC) {
    const row = await prisma.brand.create({ data: spec, select: { id: true } });
    brandIds.set(spec.slug, row.id);
  }

  const equipmentIds = new Map<string, number>();
  for (const spec of EQUIPMENT_SPEC) {
    const brandId = brandIds.get(spec.brandSlug);
    if (!brandId) throw new Error(`internal: unknown brand ${spec.brandSlug}`);
    const row = await prisma.equipment.create({
      data: { slug: spec.slug, brandId, model: spec.model, name: spec.name, equipmentType: spec.equipmentType, status: spec.status },
      select: { id: true },
    });
    equipmentIds.set(spec.model, row.id);
  }

  const categoryIds = new Map<string, number>();
  for (const spec of CATEGORY_SPEC) {
    const row = await prisma.category.create({ data: spec, select: { id: true } });
    categoryIds.set(spec.slug, row.id);
  }

  const brandAlphaId = brandIds.get(BRAND_SPEC[0].slug);
  const categoryAlphaId = categoryIds.get(CATEGORY_SPEC[0].slug);
  if (!brandAlphaId || !categoryAlphaId) throw new Error("internal: brand/category not created");

  const partNumberIds = new Map<string, number>();
  for (const spec of PART_NUMBER_SPEC) {
    const row = await prisma.partNumber.create({
      data: {
        number: spec.number,
        slug: spec.slug,
        name: spec.name,
        category: CATEGORY_SPEC[0].name,
        categoryId: categoryAlphaId,
        brandId: brandAlphaId,
        verificationStatus: spec.verificationStatus,
        publishStatus: spec.publishStatus,
        modelEvidence: "EXPLICIT",
        confidence: "HIGH",
        verified: spec.verified,
        evidenceSummary: `${P} 样例证据摘要（非真实资料）`,
      },
      select: { id: true },
    });
    partNumberIds.set(spec.number, row.id);
  }

  const supplierIds = new Map<string, number>();
  for (const spec of SUPPLIER_SPEC) {
    const row = await prisma.supplier.create({ data: spec, select: { id: true } });
    supplierIds.set(spec.slug, row.id);
  }

  const productPartNumberId = partNumberIds.get(PRODUCT_SPEC.partNumberNumber);
  const productSupplierId = supplierIds.get(PRODUCT_SPEC.supplierSlug);
  if (!productPartNumberId || !productSupplierId) throw new Error("internal: product links not resolved");
  await prisma.product.create({
    data: {
      partNumberId: productPartNumberId,
      supplierId: productSupplierId,
      name: PRODUCT_SPEC.name,
      price: PRODUCT_SPEC.price,
      currency: PRODUCT_SPEC.currency,
      status: PRODUCT_SPEC.status,
      verificationStatus: PRODUCT_SPEC.verificationStatus,
    },
    select: { id: true },
  });

  const relationPartNumberId = partNumberIds.get(RELATION_SPEC.partNumberNumber);
  const relationEquipmentId = equipmentIds.get(RELATION_SPEC.equipmentModel);
  if (!relationPartNumberId || !relationEquipmentId) throw new Error("internal: relation links not resolved");
  await prisma.partNumberEquipment.create({
    data: {
      partNumberId: relationPartNumberId,
      equipmentModelId: relationEquipmentId,
      evidenceStatus: RELATION_SPEC.evidenceStatus,
      verificationStatus: RELATION_SPEC.verificationStatus,
      evidenceSummary: RELATION_SPEC.evidenceSummary,
    },
    select: { id: true },
  });

  await prisma.rFQ.create({
    data: {
      title: RFQ_SPEC.title,
      description: RFQ_SPEC.description,
      contactName: RFQ_SPEC.contactName,
      contactPhone: RFQ_SPEC.contactPhone,
      visibility: RFQ_SPEC.visibility,
      status: RFQ_SPEC.status,
      quantity: RFQ_SPEC.quantity,
      unit: RFQ_SPEC.unit,
      brandId: brandAlphaId,
      equipmentId: relationEquipmentId,
      partNumberId: relationPartNumberId,
      categoryId: categoryAlphaId,
    },
    select: { id: true },
  });

  for (const spec of BANNER_SPEC) {
    await prisma.banner.create({ data: { ...spec, targetType: "NONE" }, select: { id: true } });
  }
}

/** 固定参考时刻的确定性时间窗断言：不依赖 CI 执行时钟。 */
async function assertWindowAtFixedNow(prisma: PrismaClient): Promise<void> {
  const matched = await prisma.banner.findMany({
    where: publicHomeBannerWhere(FIXED_NOW),
    select: { title: true },
    orderBy: { title: "asc" },
  });
  const actual = matched.map((row) => row.title);
  const expected = [`${P}-BANNER-BOUNDARY`, `${P}-BANNER-VALID`].sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error("FIXTURE_WINDOW_ASSERT_FAIL");
    console.error(`expected=${JSON.stringify(expected)}`);
    console.error(`actual=${JSON.stringify(actual)}`);
    process.exit(1);
  }
  console.log(`FIXTURE_WINDOW_ASSERT_PASS matched=${actual.length} at ${FIXED_NOW.toISOString()}`);
}

/* ============================================================
 * main
 * ============================================================ */

async function main() {
  const guardOnly = process.env.KPY_GUARD_ONLY === "1";

  const envTarget = requireEnvTarget();
  console.log(`GUARD_ENV_PASS host=${envTarget.host} port=${envTarget.port} db=${envTarget.db} user=${envTarget.user}`);

  const prisma = new PrismaClient();

  try {
    // 服务端身份校验：迁移前要求空库，迁移后要求已迁移。
    await requireServerTarget(prisma, !guardOnly);

    if (guardOnly) {
      console.log("GUARD_ONLY_PASS: identity verified, no writes performed");
      return;
    }

    const inspection = await inspectFixture(prisma);

    if (inspection.state === "COMPLETE") {
      // 全部关键样本与关系核对通过，才允许跳过。
      await assertWindowAtFixedNow(prisma);
      console.log(`FIXTURE_COMPLETE_SKIP total=${inspection.total} (verified, no writes, nothing deleted)`);
      return;
    }

    if (inspection.state === "PARTIAL") {
      console.error(`FIXTURE_PARTIAL_FAIL total=${inspection.total} issues=${inspection.issues.length}`);
      for (const issue of inspection.issues) console.error(`  - ${issue}`);
      console.error("Refusing to create/overwrite/delete. Manual review required.");
      process.exit(1);
    }

    // state === "EMPTY"：在已通过守卫的 CI 库中创建。
    await createFixture(prisma);

    // 创建后立即复核（防止 schema 默认值/精度导致与预期不一致）。
    const verification = await inspectFixture(prisma);
    if (verification.state !== "COMPLETE") {
      console.error(`FIXTURE_POSTCHECK_FAIL total=${verification.total} issues=${verification.issues.length}`);
      for (const issue of verification.issues) console.error(`  - ${issue}`);
      process.exit(1);
    }

    await assertWindowAtFixedNow(prisma);

    console.log(
      `FIXTURE_READY brands=${BRAND_SPEC.length} equipment=${EQUIPMENT_SPEC.length} ` +
        `categories=${CATEGORY_SPEC.length} partNumbers=${PART_NUMBER_SPEC.length} ` +
        `suppliers=${SUPPLIER_SPEC.length} product=1 relation=1 rfq=1 banners=${BANNER_SPEC.length} ` +
        `total=${verification.total}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("FIXTURE_FAILED:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
