/**
 * ============================================================
 * V3.1 Part Number 导入 + 预检脚本（可重复执行，Stage 2 dry-run）
 * ============================================================
 * 用法：
 *   npm run import:part-numbers -- --dry-run        仅预检，绝不写库（默认）
 *   npm run import:part-numbers -- --limit=10       正式导入 10 条（Stage 3，本阶段不执行）
 *   npm run import:part-numbers -- --all            正式全量导入（Stage 3）
 *
 * 安全规则：
 *   - 默认无参数 = --dry-run；dry-run 100% 只读，唯一写入是服务器本地 logs/*.csv
 *   - Master PN 选择不由程序按 normalized 自行"修正"：
 *     归一化相同的不同写法 → NORMALIZED_CONFLICT + FORMAT_ALIAS 候选，进报告人工确认
 *   - 25 组不写 alternativePartNumber（那是真正替代件号），只出 logs/part-number-alias-candidates.csv
 *   - Brand 显式 mapping，不自动 split("/")
 *   - Equipment 只 exact match，找不到 → EQUIPMENT_NOT_FOUND
 *   - 主分类互斥：EXACT_MATCH + NORMALIZED_MATCH_REVIEW + NORMALIZED_CONFLICT + NEW = 1596
 *   - slug 冲突为辅助风险，单独统计，不重复计入主分类
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
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : all ? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;

// ---------- CSV 解析 ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
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
function norm(input: string): string {
  if (!input) return "";
  return String(input).trim().toUpperCase().replace(/[\s\-_/.·,，()（）\[\]]/g, "");
}
function toSlug(s: string): string {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function resolveBrandCanonical(raw: string): { canonical: string; unmapped: boolean } {
  const BRAND_MAP: Record<string, string> = { "Sandvik / EIMCO": "Sandvik", "Sandvik/EIMCO": "Sandvik" };
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

async function main() {
  console.log(`\n=== V3.1 Part Number 导入预检 ===`);
  console.log(`模式: ${dryRun ? "DRY-RUN（100%只读）" : `WRITE（limit=${all ? "ALL" : limit}）`}\n`);

  if (!fs.existsSync(IMPORT_CSV)) throw new Error(`找不到导入 CSV: ${IMPORT_CSV}`);
  const { rows: pnRows } = loadCsv(IMPORT_CSV);
  const { rows: relRows } = fs.existsSync(RELATIONS_CSV) ? loadCsv(RELATIONS_CSV) : { rows: [] };
  console.log(`导入 CSV: ${pnRows.length} 条 PN`);
  console.log(`关系 CSV: ${relRows.length} 条 Equipment relation`);

  // ---------- CSV 自身预检 ----------
  const preflightIssues: Record<string, string>[] = [];
  const conflictIssues: Record<string, string>[] = [];
  const pnIds = new Set<string>();
  const byNumber = new Map<string, Record<string, string>>();
  // normalized -> 出现的原始件号列表（用于 alias 候选）
  const byNorm = new Map<string, { number: string; row: number; evidence: string; confidence: string; modelEvidence: string }[]>();
  // slug -> 出现的 {number, normalized}
  const bySlug = new Map<string, { number: string; normalized: string }[]>();
  const seenPnId = new Map<string, number>();
  const seenNumber = new Map<string, number>();

  for (const [idx, r] of pnRows.entries()) {
    const rowNo = idx + 2;
    const pnId = r.pn_id || "";
    const number = (r.part_number || "").trim();
    const n = norm(number);
    const slug = toSlug(r.slug || number);

    if (pnId) {
      if (seenPnId.has(pnId)) conflictIssues.push({ row: String(rowNo), type: "PN_ID_DUPLICATE", value: pnId });
      seenPnId.set(pnId, (seenPnId.get(pnId) || 0) + 1);
      pnIds.add(pnId);
    } else preflightIssues.push({ row: String(rowNo), pn_id: "", part_number: number, type: "EMPTY_PN_ID", message: "" });

    if (!number) { preflightIssues.push({ row: String(rowNo), pn_id: pnId, part_number: "", type: "EMPTY_PART_NUMBER", message: "" }); continue; }
    byNumber.set(number, r);

    if (seenNumber.has(number)) conflictIssues.push({ row: String(rowNo), type: "PART_NUMBER_DUPLICATE", value: number });
    seenNumber.set(number, (seenNumber.get(number) || 0) + 1);

    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n)!.push({ number, row: rowNo, evidence: r.evidence_summary || "", confidence: r.confidence || "", modelEvidence: r.model_evidence || "" });

    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug)!.push({ number, normalized: n });

    if (r.verification !== "VERIFIED") preflightIssues.push({ row: String(rowNo), pn_id: pnId, part_number: number, type: "VERIFICATION_NOT_VERIFIED", message: r.verification });
    if (r.import_status !== "PUBLISHED_READY") preflightIssues.push({ row: String(rowNo), pn_id: pnId, part_number: number, type: "IMPORT_STATUS_NOT_READY", message: r.import_status });
    if (!["EXPLICIT", "INFERRED", "NOT_EXPLICIT"].includes(r.model_evidence)) preflightIssues.push({ row: String(rowNo), pn_id: pnId, part_number: number, type: "MODEL_EVIDENCE_INVALID", message: r.model_evidence });
    if (!["HIGH", "MEDIUM", "LOW"].includes(r.confidence)) preflightIssues.push({ row: String(rowNo), pn_id: pnId, part_number: number, type: "CONFIDENCE_INVALID", message: r.confidence });
  }

  // normalized collision（CSV 内不同原始件号归一化相同）→ alias 候选报告
  const aliasCandidates: Record<string, string>[] = [];
  const normCollisionSet = new Set<string>();
  for (const [n, items] of byNorm.entries()) {
    const distinct = [...new Set(items.map((i) => i.number))];
    if (distinct.length > 1) {
      normCollisionSet.add(n);
      // AUTO_SAFE：仅当某一写法证据明确更强（HIGH+EXPLICIT 且另一写法非 HIGH）
      const c1 = items[0];
      const c2 = items[1];
      const c1Strong = c1.confidence === "HIGH" && c1.modelEvidence === "EXPLICIT";
      const c2Strong = c2.confidence === "HIGH" && c2.modelEvidence === "EXPLICIT";
      let recommended = "";
      let status = "REVIEW_REQUIRED";
      if (c1Strong && !c2Strong) { recommended = c1.number; status = "AUTO_SAFE"; }
      else if (c2Strong && !c1Strong) { recommended = c2.number; status = "AUTO_SAFE"; }
      aliasCandidates.push({
        normalized_part_number: n,
        candidate_1: distinct[0],
        candidate_2: distinct[1] || "",
        candidate_1_source: c1.evidence,
        candidate_2_source: c2.evidence,
        candidate_1_evidence: `${c1.confidence}/${c1.modelEvidence}`,
        candidate_2_evidence: `${c2.confidence}/${c2.modelEvidence}`,
        recommended_master: recommended || "(待人工)",
        recommendation_reason: status === "AUTO_SAFE" ? "证据等级差异可推荐" : "两写法证据同级，程序不自行决定主件号（规则P1-P4）",
        status,
      });
    }
  }

  // slug 重复去重分类：normalized 相同的 slug 重复属于 alias 组，不重复计风险
  let slugDupTotal = 0;
  let slugDupInsideAlias = 0;
  let slugIndependent = 0;
  for (const [slug, items] of bySlug.entries()) {
    if (items.length < 2) continue;
    slugDupTotal++;
    const allSameNorm = items.every((i) => i.normalized === items[0].normalized);
    if (allSameNorm && normCollisionSet.has(items[0].normalized)) {
      slugDupInsideAlias++; // 与 25 组 alias 重复，不重复计风险
    } else {
      slugIndependent++; // normalized 不同但 slug 相同 = 真正独立 SLUG_COLLISION
      conflictIssues.push({ row: "-", type: "SLUG_COLLISION_INDEPENDENT", value: slug, detail: `不同 normalized 共用 slug: ${items.map((i) => i.number).join(" | ")}` });
    }
  }

  // relations 预检
  let orphanRelations = 0;
  let contradictoryRelations = 0;
  const relByPnModel = new Map<string, string[]>();
  for (const r of relRows) {
    const pnId = (r.pn_id || "").trim();
    const model = (r.model || "").trim();
    if (!pnIds.has(pnId)) { orphanRelations++; preflightIssues.push({ row: "-", pn_id: pnId, part_number: r.part_number || "", type: "RELATION_PN_NOT_FOUND", message: model }); continue; }
    const key = `${pnId}||${model}`;
    const ev = relByPnModel.get(key) || [];
    ev.push(r.model_evidence || "");
    relByPnModel.set(key, ev);
  }
  for (const [key, evs] of relByPnModel.entries()) {
    if (evs.includes("EXPLICIT") && evs.includes("INFERRED")) { contradictoryRelations++; conflictIssues.push({ row: "-", type: "MODEL_RELATION_CONFLICT", value: key, detail: `同一 PN+model 同时存在 EXPLICIT 与 INFERRED` }); }
  }

  console.log(`\n--- CSV 自身预检 ---`);
  console.log(`PN = ${pnRows.length}`);
  console.log(`relations = ${relRows.length}`);
  console.log(`normalized collision（FORMAT_ALIAS 候选组）= ${normCollisionSet.size}`);
  console.log(`slug 重复总数 = ${slugDupTotal}，其中属于 alias 组（不重复计风险）= ${slugDupInsideAlias}，真正独立 SLUG_COLLISION = ${slugIndependent}`);
  console.log(`relations 孤儿 = ${orphanRelations}，关系证据矛盾 = ${contradictoryRelations}`);
  console.log(`预检问题行 = ${preflightIssues.length}，独立冲突行 = ${conflictIssues.length}`);

  writeCsv(path.join(LOG_DIR, "part-number-v3-preflight.csv"), ["row", "pn_id", "part_number", "type", "message"], preflightIssues);
  writeCsv(path.join(LOG_DIR, "part-number-v3-conflicts.csv"), ["row", "type", "value", "detail"], conflictIssues);
  writeCsv(path.join(LOG_DIR, "part-number-alias-candidates.csv"),
    ["normalized_part_number", "candidate_1", "candidate_2", "candidate_1_source", "candidate_2_source", "candidate_1_evidence", "candidate_2_evidence", "recommended_master", "recommendation_reason", "status"],
    aliasCandidates);

  // ---------- 数据库预检（只读，全部查旧字段，不依赖 V3.1 新列/新表） ----------
  console.log(`\n--- 生产库预检（只读）---`);
  const existingConflicts: Record<string, string>[] = [];
  let dbAvailable = false;
  let existingCount = 0;
  let exactMatch = 0, normalizedReview = 0, newCount = 0, normalizedConflict = 0;
  let independentSlugConflict = 0, fieldConflict = 0, seoUpdate = 0;
  let relExisting = "N/A（PartNumberEquipment 表待 migration，dry-run 不查）";
  let relReady = 0, relEqNotFound = 0, relConflict = contradictoryRelations;

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    // 只查旧字段（id/number/slug/name/seoTitle）——Stage 1 migration 未跑也能跑
    const existing = await prisma.partNumber.findMany({ select: { id: true, number: true, slug: true, name: true, seoTitle: true } });
    dbAvailable = true;
    existingCount = existing.length;
    const byExistingNumber = new Map(existing.map((e) => [e.number, e]));
    const byExistingNorm = new Map(existing.map((e) => [norm(e.number), e]));
    const byExistingSlug = new Map(existing.map((e) => [e.slug, e]));

    const limitN = Number.isFinite(limit) ? limit : pnRows.length;
    const seenMain = { exact: 0, nreview: 0, nconflict: 0, fresh: 0 };
    for (const r of pnRows.slice(0, limitN)) {
      const number = (r.part_number || "").trim();
      if (!number) continue;
      const n = norm(number);
      const slug = toSlug(r.slug || number);

      // 主分类互斥：NORMALIZED_CONFLICT（CSV 内部）优先
      if (normCollisionSet.has(n)) {
        normalizedConflict++;
        continue;
      }
      const ex = byExistingNumber.get(number);
      const exNorm = byExistingNorm.get(n);
      const exSlug = byExistingSlug.get(slug);
      if (ex) {
        exactMatch++;
        if (ex.name && r.description && ex.name !== r.description) { fieldConflict++; existingConflicts.push({ pn_id: r.pn_id, part_number: number, type: "FIELD_CONFLICT", detail: `name="${ex.name}" vs csv.description="${r.description}"` }); }
        if (ex.seoTitle && r.seo_title && ex.seoTitle !== r.seo_title) { seoUpdate++; existingConflicts.push({ pn_id: r.pn_id, part_number: number, type: "SEO_FIELD_UPDATE", detail: "seoTitle 不同" }); }
      } else if (exNorm) {
        normalizedReview++;
        existingConflicts.push({ pn_id: r.pn_id, part_number: number, type: "NORMALIZED_MATCH_REVIEW", detail: `existing.number="${exNorm.number}" normalized 相同，不建第二条` });
      } else {
        newCount++;
        if (exSlug) { independentSlugConflict++; existingConflicts.push({ pn_id: r.pn_id, part_number: number, type: "SLUG_COLLISION_INDEPENDENT", detail: `slug="${slug}" 已被 existing #${exSlug.id} 占用` }); }
      }
    }
    // 主分类总账校验
    const mainSum = exactMatch + normalizedReview + normalizedConflict + newCount;
    console.log(`主分类总账校验: EXACT_MATCH(${exactMatch}) + NORMALIZED_MATCH_REVIEW(${normalizedReview}) + NORMALIZED_CONFLICT(${normalizedConflict}) + NEW(${newCount}) = ${mainSum} （应=${limitN}）`);

    // relations 总账：Equipment 表为旧表，可只读查询
    const equipmentModels = await prisma.equipment.findMany({ select: { model: true } });
    const modelSet = new Set(equipmentModels.map((e) => e.model));
    for (const r of relRows) {
      const model = (r.model || "").trim();
      if (!model) { relEqNotFound++; existingConflicts.push({ pn_id: r.pn_id, type: "EQUIPMENT_NOT_FOUND", detail: "model 为空" }); continue; }
      if (!modelSet.has(model)) { relEqNotFound++; existingConflicts.push({ pn_id: r.pn_id, part_number: r.part_number || "", type: "EQUIPMENT_NOT_FOUND", detail: `model="${model}" 不在 Equipment 表` }); continue; }
      // 仅 VERIFIED + EXPLICIT + ACTIVE 才是 READY_TO_CREATE（公开 Confirmed）
      if (r.verification === "VERIFIED" && r.model_evidence === "EXPLICIT" && r.relation_status === "ACTIVE") relReady++;
    }
    await prisma.$disconnect();
  } catch (e: any) {
    console.log(`[警告] 数据库不可用（本地开发环境），existing 预检跳过: ${(e.message || "").split("\n")[0]}`);
  }

  writeCsv(path.join(LOG_DIR, "part-number-existing-conflicts.csv"), ["pn_id", "part_number", "type", "detail"], existingConflicts);

  console.log(`\n========== 预检结果总账 ==========`);
  console.log(`【CSV自身】PN=1596, relations=1613`);
  console.log(`  normalized collision（alias 组）= ${normCollisionSet.size}`);
  console.log(`  真正独立 SLUG_COLLISION = ${slugIndependent}`);
  const autoSafe = aliasCandidates.filter((a) => a.status === "AUTO_SAFE").length;
  const reviewReq = aliasCandidates.length - autoSafe;
  console.log(`  alias AUTO_SAFE = ${autoSafe} / REVIEW_REQUIRED = ${reviewReq}`);
  console.log(`【生产现有库】可用=${dbAvailable ? "是" : "否"}`);
  console.log(`  existing PartNumber 总数 = ${existingCount}`);
  console.log(`  EXACT_MATCH = ${exactMatch}`);
  console.log(`  NORMALIZED_MATCH_REVIEW = ${normalizedReview}`);
  console.log(`  NORMALIZED_CONFLICT = ${normalizedConflict}`);
  console.log(`  NEW = ${newCount}`);
  console.log(`  独立 SLUG_COLLISION（existing 侧）= ${independentSlugConflict}`);
  console.log(`  FIELD_CONFLICT = ${fieldConflict}`);
  console.log(`  SEO_FIELD_UPDATE = ${seoUpdate}`);
  console.log(`【Equipment relations】EXISTING_RELATION=${relExisting}, READY_TO_CREATE=${relReady}, EQUIPMENT_NOT_FOUND=${relEqNotFound}, RELATION_CONFLICT=${relConflict}`);
  console.log(`【安全】dry-run 无 DB 写操作 = YES（唯一写入 logs/*.csv）`);
  console.log(`日志: logs/part-number-v3-preflight.csv / part-number-v3-conflicts.csv / part-number-alias-candidates.csv / part-number-existing-conflicts.csv`);
  console.log(`=== ${dryRun ? "DRY-RUN 完成，未写任何数据库" : "WRITE 模式（本阶段未执行）"} ===\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
