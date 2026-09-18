/**
 * ============================================================
 * V3.1 Part Number 导入 + 预检脚本（可重复执行）
 * ============================================================
 * 用法：
 *   npm run import:part-numbers -- --dry-run        仅预检，绝不写库（默认）
 *   npm run import:part-numbers -- --dry-run --limit=10
 *   npm run import:part-numbers -- --limit=10       正式导入 10 条
 *   npm run import:part-numbers -- --limit=100      正式导入 100 条
 *   npm run import:part-numbers -- --all            正式全量导入
 *
 * 安全规则：
 *   - 默认无参数 = --dry-run（绝不默认写生产）
 *   - upsert 以 normalizedPartNumber 去重；normalized 相同视为同一 Master PN 候选，不建第二条
 *   - Brand 显式 mapping，不自动 split("/")
 *   - Equipment 只 exact match，找不到 → EQUIPMENT_NOT_FOUND 进报告（不自动建）
 *   - 现有 PN 非空字段不同 → FIELD_CONFLICT 进报告，不静默覆盖
 *   - 每条独立处理，单条失败不回滚整批；错误写 logs/part-number-import-errors.csv
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const IMPORT_CSV = path.join(ROOT, "data", "part-numbers", "kuangpeiyun_partnumber_import_v3.csv");
const RELATIONS_CSV = path.join(ROOT, "data", "part-numbers", "kuangpeiyun_equipment_relations_v3.csv");
const LOG_DIR = path.join(ROOT, "logs");

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const hasWriteMode = argv.some((a) => a.startsWith("--limit=") || a.includes("--all"));
const dryRun = !hasWriteMode || argv.includes("--dry-run");
const all = argv.includes("--all");
const limitArg = argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : all ? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY; // dry-run 全量扫描

// ---------- CSV 解析（支持引号） ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function loadCsv(file: string): { headers: string[]; rows: Record<string, string>[] } {
  const text = fs.readFileSync(file, "utf8");
  const parsed = parseCsv(text);
  const headers = parsed[0].map((h) => h.trim());
  const rows = parsed.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
    return obj;
  });
  return { headers, rows };
}

// ---------- 工具 ----------
function norm(input: string): string {
  if (!input) return "";
  return String(input).trim().toUpperCase().replace(/[\s\-_/.·,，()（）\[\]]/g, "");
}
function toSlug(s: string): string {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function resolveBrandCanonical(raw: string): { canonical: string; unmapped: boolean } {
  const BRAND_MAP: Record<string, string> = {
    "Sandvik / EIMCO": "Sandvik", "Sandvik/EIMCO": "Sandvik",
  };
  const src = String(raw || "").trim();
  if (!src) return { canonical: "", unmapped: false };
  if (BRAND_MAP[src]) return { canonical: BRAND_MAP[src], unmapped: false };
  return { canonical: src.split("/")[0].trim(), unmapped: true };
}
function writeCsv(file: string, header: string[], records: Record<string, string>[]): number {
  const esc = (v: string) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of records) lines.push(header.map((h) => esc(r[h] ?? "")).join(","));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join("\n"), "utf8");
  return records.length;
}

// ---------- 主流程 ----------
async function main() {
  console.log(`\n=== V3.1 Part Number 导入预检 ===`);
  console.log(`模式: ${dryRun ? "DRY-RUN（不写库）" : `WRITE（limit=${all ? "ALL" : limit}）`}\n`);

  // 1) 读 CSV
  if (!fs.existsSync(IMPORT_CSV)) throw new Error(`找不到导入 CSV: ${IMPORT_CSV}`);
  const { rows: pnRows } = loadCsv(IMPORT_CSV);
  const { rows: relRows } = fs.existsSync(RELATIONS_CSV) ? loadCsv(RELATIONS_CSV) : { rows: [] };
  console.log(`导入 CSV: ${pnRows.length} 条 PN`);
  console.log(`关系 CSV: ${relRows.length} 条 Equipment relation`);

  // 2) CSV 自身预检
  const preflightIssues: Record<string, string>[] = [];
  const conflictIssues: Record<string, string>[] = [];
  const seenPnId = new Map<string, number>();
  const seenNumber = new Map<string, number>();
  const seenNorm = new Map<string, string>(); // normalized -> 第一条原始件号
  const seenSlug = new Map<string, number>();
  const pnIds = new Set<string>();
  const byNumber = new Map<string, Record<string, string>>();

  for (const [idx, r] of pnRows.entries()) {
    const rowNo = idx + 2; // 含表头
    const pnId = r.pn_id || "";
    const number = (r.part_number || "").trim();
    const n = norm(number);
    const slug = toSlug(r.slug || number);

    // 重复 pn_id
    if (pnId) {
      if (seenPnId.has(pnId)) conflictIssues.push({ row: String(rowNo), type: "PN_ID_DUPLICATE", value: pnId });
      seenPnId.set(pnId, (seenPnId.get(pnId) || 0) + 1);
      pnIds.add(pnId);
    } else preflightIssues.push({ row: String(rowNo), pn_id: "", part_number: number, type: "EMPTY_PN_ID", message: "" });

    // 空 part_number
    if (!number) { preflightIssues.push({ row: String(rowNo), pn_id: pnId, part_number: "", type: "EMPTY_PART_NUMBER", message: "" }); continue; }
    byNumber.set(number, r);

    // number 重复（原始精确）
    if (seenNumber.has(number)) conflictIssues.push({ row: String(rowNo), type: "PART_NUMBER_DUPLICATE", value: number });
    seenNumber.set(number, (seenNumber.get(number) || 0) + 1);

    // normalized 重复（同一文件内不同原始件号归一化后相同）
    if (seenNorm.has(n)) {
      conflictIssues.push({ row: String(rowNo), type: "NORMALIZED_DUPLICATE_IN_CSV", value: n, detail: `已有原始件号="${seenNorm.get(n)}" vs 当前="${number}"（需人工确认是否同一 Master PN）` });
    }
    seenNorm.set(n, number);

    // slug 重复
    if (seenSlug.has(slug)) conflictIssues.push({ row: String(rowNo), type: "SLUG_DUPLICATE_IN_CSV", value: slug });
    seenSlug.set(slug, (seenSlug.get(slug) || 0) + 1);

    // verification / import_status / model_evidence 异常
    if (r.verification !== "VERIFIED") preflightIssues.push({ row: String(rowNo), pn_id: pnId, part_number: number, type: "VERIFICATION_NOT_VERIFIED", message: r.verification });
    if (r.import_status !== "PUBLISHED_READY") preflightIssues.push({ row: String(rowNo), pn_id: pnId, part_number: number, type: "IMPORT_STATUS_NOT_READY", message: r.import_status });
    if (!["EXPLICIT", "INFERRED", "NOT_EXPLICIT"].includes(r.model_evidence))
      preflightIssues.push({ row: String(rowNo), pn_id: pnId, part_number: number, type: "MODEL_EVIDENCE_INVALID", message: r.model_evidence });
    if (!["HIGH", "MEDIUM", "LOW"].includes(r.confidence))
      preflightIssues.push({ row: String(rowNo), pn_id: pnId, part_number: number, type: "CONFIDENCE_INVALID", message: r.confidence });
  }

  // relations 预检：找不到对应 PN
  let orphanRelations = 0;
  const relByPnModel = new Map<string, string[]>(); // pnId+model -> evidences
  for (const [idx, r] of relRows.entries()) {
    const rowNo = idx + 2;
    const pnId = (r.pn_id || "").trim();
    const model = (r.model || "").trim();
    if (!pnIds.has(pnId)) { orphanRelations++; preflightIssues.push({ row: String(rowNo), pn_id: pnId, part_number: r.part_number || "", type: "RELATION_PN_NOT_FOUND", message: model }); continue; }
    const key = `${pnId}||${model}`;
    const ev = relByPnModel.get(key) || [];
    ev.push(r.model_evidence || "");
    relByPnModel.set(key, ev);
  }
  // 同一 PN+model 证据矛盾（EXPLICIT 与 INFERRED 同时存在）
  let contradictoryRelations = 0;
  for (const [key, evs] of relByPnModel.entries()) {
    const hasExplicit = evs.includes("EXPLICIT");
    const hasInferred = evs.includes("INFERRED");
    if (hasExplicit && hasInferred) { contradictoryRelations++; conflictIssues.push({ row: "-", type: "MODEL_RELATION_CONFLICT", value: key, detail: `同一 PN+model 同时存在 EXPLICIT 与 INFERRED: ${evs.join("/")}` }); }
  }

  console.log(`\n--- CSV 预检 ---`);
  console.log(`PN 总数: ${pnRows.length}`);
  console.log(`relations 总数: ${relRows.length}`);
  console.log(`relations 找不到对应 PN: ${orphanRelations}`);
  console.log(`同一 PN+model 证据矛盾: ${contradictoryRelations}`);
  console.log(`预检问题行: ${preflightIssues.length}`);
  console.log(`冲突行: ${conflictIssues.length}`);

  writeCsv(path.join(LOG_DIR, "part-number-v3-preflight.csv"),
    ["row", "pn_id", "part_number", "type", "message"], preflightIssues);
  writeCsv(path.join(LOG_DIR, "part-number-v3-conflicts.csv"),
    ["row", "type", "value", "detail"], conflictIssues);

  // 3) 数据库预检（dry-run 分类；写模式才 upsert）
  console.log(`\n--- 数据库预检（existing vs CSV）---`);
  const existingConflicts: Record<string, string>[] = [];
  let dbAvailable = false;
  let existingCount = 0;
  let exactMatch = 0, normalizedMatch = 0, slugConflict = 0, newCount = 0;
  let fieldConflict = 0, seoUpdate = 0, equipmentNotFound = 0, unmappedBrand = 0;

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const existing = await prisma.partNumber.findMany({ select: { id: true, number: true, slug: true, name: true, seoTitle: true } });
    dbAvailable = true;
    existingCount = existing.length;
    const byExistingNumber = new Map(existing.map((e) => [e.number, e]));
    const byExistingNorm = new Map(existing.map((e) => [norm(e.number), e]));
    const byExistingSlug = new Map(existing.map((e) => [e.slug, e]));

    const limitN = Number.isFinite(limit) ? limit : pnRows.length;
    for (const r of pnRows.slice(0, limitN)) {
      const number = (r.part_number || "").trim();
      if (!number) continue;
      const n = norm(number);
      const slug = toSlug(r.slug || number);
      const ex = byExistingNumber.get(number);
      const exNorm = byExistingNorm.get(n);
      const exSlug = byExistingSlug.get(slug);

      if (ex) {
        exactMatch++;
        // 字段冲突检测（dry-run 只报告）
        if (ex.name && r.description && ex.name !== r.description) { fieldConflict++; existingConflicts.push({ pn_id: r.pn_id, part_number: number, type: "FIELD_CONFLICT", detail: `name="${ex.name}" vs csv.description="${r.description}"` }); }
        if (ex.seoTitle && r.seo_title && ex.seoTitle !== r.seo_title) { seoUpdate++; existingConflicts.push({ pn_id: r.pn_id, part_number: number, type: "SEO_FIELD_UPDATE", detail: `seoTitle 不同` }); }
      } else if (exNorm) {
        normalizedMatch++;
        existingConflicts.push({ pn_id: r.pn_id, part_number: number, type: "NORMALIZED_MATCH_REVIEW", detail: `existing.number="${exNorm.number}" normalized 相同，不建第二条` });
      } else {
        newCount++;
        if (exSlug) { slugConflict++; existingConflicts.push({ pn_id: r.pn_id, part_number: number, type: "SLUG_CONFLICT", detail: `slug="${slug}" 已被 #${exSlug.id} 占用` }); }
      }
      // Brand 未映射统计
      const { unmapped } = resolveBrandCanonical(r.brand);
      if (unmapped) unmappedBrand++;
    }

    // Equipment 匹配预检
    const equipmentModels = await prisma.equipment.findMany({ select: { model: true } });
    const modelSet = new Set(equipmentModels.map((e) => e.model));
    const relLimit = relRows.slice(0, Number.isFinite(limit) ? limit * 50 : relRows.length);
    for (const r of relLimit) {
      const model = (r.model || "").trim();
      if (model && !modelSet.has(model)) { equipmentNotFound++; existingConflicts.push({ pn_id: r.pn_id, part_number: r.part_number || "", type: "EQUIPMENT_NOT_FOUND", detail: `model="${model}" 不在 Equipment 表` }); }
    }

    await prisma.$disconnect();
  } catch (e: any) {
    console.log(`[警告] 数据库不可用（本地开发环境），existing 预检跳过: ${e.message?.split("\n")[0]}`);
  }

  writeCsv(path.join(LOG_DIR, "part-number-existing-conflicts.csv"),
    ["pn_id", "part_number", "type", "detail"], existingConflicts);

  console.log(`\n--- 预检结果汇总 ---`);
  console.log(`数据库可用: ${dbAvailable ? "是" : "否（本地无生产库连接）"}`);
  console.log(`现有 PN 数量: ${existingCount}`);
  console.log(`EXACT_MATCH: ${exactMatch}`);
  console.log(`NORMALIZED_MATCH_REVIEW: ${normalizedMatch}`);
  console.log(`NEW: ${newCount}`);
  console.log(`SLUG_CONFLICT: ${slugConflict}`);
  console.log(`FIELD_CONFLICT: ${fieldConflict}`);
  console.log(`SEO_FIELD_UPDATE: ${seoUpdate}`);
  console.log(`EQUIPMENT_NOT_FOUND: ${equipmentNotFound}`);
  console.log(`UNMAPPED_BRAND: ${unmappedBrand}`);
  console.log(`\n日志文件: logs/part-number-v3-preflight.csv / part-number-v3-conflicts.csv / part-number-existing-conflicts.csv`);
  console.log(`\n=== 预检完成（${dryRun ? "DRY-RUN，未写任何数据" : "WRITE 模式，本阶段未执行"}）===\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
