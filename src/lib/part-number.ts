/**
 * ============================================================
 * 矿配云 Part Number 标准化工具（V3.1）
 * ============================================================
 * 规则：
 *  - normalizePartNumber 仅用于【搜索 / 匹配 / 去重 / 冲突检测】
 *  - 绝对不覆盖厂家原始件号（PartNumber.number 永远保留原始值）
 *  - 禁止根据 normalized 结果猜测厂家标准格式
 */

/**
 * 归一化件号：trim → 大写 → 去除常见格式分隔符。
 * 例：
 *   "A2U220-324006" / "A2U220 324006" / "a2u220-324006" / "A2U220_324006"
 *   → "A2U220324006"
 */
export function normalizePartNumber(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .trim()
    .toUpperCase()
    // 去除：空格、连字符、下划线、斜杠、点号、中文括号等常见格式分隔符
    .replace(/[\s\-_/.·,，()（）\[\]]/g, "");
}

/**
 * 品牌标准化映射（显式 mapping，禁止自动 split("/")）。
 * 原则：一个 CSV 原始品牌词 → 一个 canonical 品牌；
 * EIMCO 这类历史体系信息不自动创建第二个 Brand。
 */
const BRAND_CANONICAL_MAP: Record<string, string> = {
  "Sandvik / EIMCO": "Sandvik",
  "Sandvik/EIMCO": "Sandvik",
  "Komatsu / Mining": "Komatsu",
  "Komatsu / P&H": "Komatsu",
  "Bucyrus / CAT": "Bucyrus",
  "JOY / Caterpillar": "JOY",
};

export interface BrandResolution {
  /** 标准化品牌名（用于匹配现有 Brand.name） */
  canonical: string;
  /** CSV 原始品牌词（原样保留，写入 sourceFiles/evidence） */
  source: string;
  /** 是否来自显式 mapping */
  mapped: boolean;
  /** 是否未在 mapping 中（进报告人工确认，不自动建 Brand） */
  unmapped: boolean;
}

export function resolveBrand(raw: string | null | undefined): BrandResolution {
  const source = String(raw || "").trim();
  if (!source) return { canonical: "", source: "", mapped: false, unmapped: false };
  const mapped = BRAND_CANONICAL_MAP[source];
  if (mapped) return { canonical: mapped, source, mapped: true, unmapped: false };
  // 未在 mapping：不自动 split 创建多 Brand；取 "/" 前第一段作候选，标记 unmapped 进报告
  const candidate = source.split("/")[0].trim();
  return { canonical: candidate, source, mapped: false, unmapped: true };
}

/** 公开数据过滤唯一真相：verificationStatus=VERIFIED AND publishStatus=READY */
export const PUBLIC_PN_WHERE = {
  verificationStatus: "VERIFIED",
  publishStatus: "READY",
} as const;

/** 校验枚举值合法性（导入用） */
export const MODEL_EVIDENCE_VALUES = ["EXPLICIT", "INFERRED", "NOT_EXPLICIT"];
export const VERIFICATION_VALUES = ["CANDIDATE", "UNVERIFIED", "VERIFIED", "CONFLICT", "REJECTED"];
export const CONFIDENCE_VALUES = ["HIGH", "MEDIUM", "LOW"];
export const PUBLISH_STATUS_VALUES = ["READY", "HOLD", "HIDDEN"];
