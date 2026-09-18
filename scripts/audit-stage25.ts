/**
 * ============================================================
 * V3.1 Stage 2.5 审计脚本（100% 只读）
 * 产出：
 *   logs/part-number-master-groups.csv     — 1596 条原始记录 → Master PN group
 *   logs/equipment-master-missing.csv     — 1613 relations 按 Brand+Equipment+Model 聚合
 *   logs/part-number-existing-collisions.csv — CSV PN 与生产 existing PN 的 normalized 碰撞
 * 只读：不 create/update/merge/backfill/migrate/import
 * ============================================================
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const IMPORT_CSV = path.join(ROOT, "data", "part-numbers", "kuangpeiyun_partnumber_import_v3.csv");
const RELATIONS_CSV = path.join(ROOT, "data", "part-numbers", "kuangpeiyun_equipment_relations_v3.csv");
const LOG_DIR = path.join(ROOT, "logs");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
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
  const parsed = parseCsv(fs.readFileSync(file, "utf8"));
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
function normModel(s: string): string {
  // 设备型号规范化：去空格/横杠后大写（仅用于"匹配候选"，不自动合并）
  return norm(s);
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
function resolveBrand(raw: string): { canonical: string; unmapped: boolean } {
  const MAP: Record<string, string> = { "Sandvik / EIMCO": "Sandvik", "Sandvik/EIMCO": "Sandvik" };
  const src = String(raw || "").trim();
  if (!src) return { canonical: "", unmapped: false };
  if (MAP[src]) return { canonical: MAP[src], unmapped: false };
  return { canonical: src.split("/")[0].trim(), unmapped: true };
}

async function main() {
  console.log(`\n=== V3.1 Stage 2.5 只读审计 ===\n`);

  const { rows: pnRows } = loadCsv(IMPORT_CSV);
  const { rows: relRows } = loadCsv(RELATIONS_CSV);
  console.log(`PN CSV = ${pnRows.length}, Relations CSV = ${relRows.length}`);

  // ========== 1) CSV 侧 Master PN Group ==========
  // normalized -> members[]
  const byNorm = new Map<string, any[]>();
  const pnIds = new Set<string>();
  for (const r of pnRows) {
    const number = (r.part_number || "").trim();
    if (!number) continue;
    pnIds.add(r.pn_id);
    const n = norm(number);
    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n)!.push({
      number,
      pn_id: r.pn_id,
      brand: resolveBrand(r.brand).canonical,
      evidence: r.evidence_summary || "",
      source_files: r.source_files || "",
      confidence: r.confidence || "",
      modelEvidence: r.model_evidence || "",
    });
  }

  // ========== 2) 数据库只读探测 ==========
  let dbAvailable = false;
  let existingCount = 0;
  const existingByNorm = new Map<string, { id: number; number: string; slug: string }>();
  const equipmentRows: { id: number; brand: string; model: string; name: string; equipmentType: string; series: string }[] = [];
  let pnTableHasNewCols = "UNKNOWN";
  let partNumberEquipmentExists = "UNKNOWN";
  let partNumberAuditLogExists = "UNKNOWN";

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    // existing PartNumber（旧字段）
    const existing = await prisma.partNumber.findMany({ select: { id: true, number: true, slug: true } });
    dbAvailable = true;
    existingCount = existing.length;
    for (const e of existing) existingByNorm.set(norm(e.number), { id: e.id, number: e.number, slug: e.slug });

    // Equipment 表（旧字段）
    const eq = await prisma.equipment.findMany({ select: { id: true, brand: true, model: true, name: true, equipmentType: true, series: true } });
    for (const x of eq) equipmentRows.push({ id: x.id, brand: String(x.brand || ""), model: String(x.model || ""), name: String(x.name || ""), equipmentType: String(x.equipmentType || ""), series: String(x.series || "") });

    // PartNumber 新列是否存在（查一行，看 normalizedPartNumber 字段是否报错）
    try {
      const one = await prisma.partNumber.findFirst({ select: { normalizedPartNumber: true } });
      pnTableHasNewCols = one ? "YES" : "YES (rows exist but column returned null — column present)";
    } catch (e: any) {
      pnTableHasNewCols = `NO (${(e.message || "").split("\n")[0].slice(0, 120)})`;
    }
    // PartNumberEquipment / PartNumberAuditLog 表是否存在
    try { await prisma.partNumberEquipment.count(); partNumberEquipmentExists = "YES"; }
    catch { partNumberEquipmentExists = "NO"; }
    try { await prisma.partNumberAuditLog.count(); partNumberAuditLogExists = "YES"; }
    catch { partNumberAuditLog = "NO"; }

    await prisma.$disconnect();
  } catch (e: any) {
    console.log(`[警告] DB 不可用，DB 侧审计跳过: ${(e.message || "").split("\n")[0]}`);
  }

  // ========== 3) Master group 分类 ==========
  const masterGroups: Record<string, string>[] = [];
  let singleCount = 0, aliasReviewCount = 0, existingReviewCount = 0, trueConflictCount = 0;
  const existingCollisions: Record<string, string>[] = [];

  for (const [n, members] of Array.from(byNorm.entries())) {
    const distinct = [...new Set(members.map((m) => m.number))];
    const matchExisting = existingByNorm.get(n);
    if (distinct.length === 1 && !matchExisting) {
      singleCount++;
      masterGroups.push({ normalized_part_number: n, member_count: "1", members: distinct[0], source_count: String(members.length), existing_db_match: "", recommended_master: distinct[0], recommendation_reason: "唯一写法", status: "SINGLE" });
    } else if (distinct.length === 1 && matchExisting) {
      existingReviewCount++;
      masterGroups.push({ normalized_part_number: n, member_count: "1", members: distinct[0], source_count: String(members.length), existing_db_match: `#${matchExisting.id} "${matchExisting.number}"`, recommended_master: matchExisting.number, recommendation_reason: "与生产 existing 归一化相同，按 existing 主件号", status: "EXISTING_MATCH_REVIEW" });
      existingCollisions.push({ existing_number: matchExisting.number, csv_number: distinct[0], normalized: n, existing_slug: matchExisting.slug, csv_slug: "", classification: "NORMALIZED_MATCH_REVIEW" });
    } else {
      // 多写法 alias
      aliasReviewCount++;
      // occurrence_count：同写法在 CSV 出现次数
      const occ = new Map<string, number>();
      for (const m of members) occ.set(m.number, (occ.get(m.number) || 0) + 1);
      masterGroups.push({
        normalized_part_number: n,
        member_count: String(distinct.length),
        members: distinct.join(" | "),
        source_count: String(members.length),
        existing_db_match: matchExisting ? `#${matchExisting.id}` : "",
        recommended_master: "(人工)",
        recommendation_reason: "FORMAT_ALIAS，程序不定主件号",
        status: "FORMAT_ALIAS_REVIEW",
      });
    }
  }
  writeCsv(path.join(LOG_DIR, "part-number-master-groups.csv"),
    ["normalized_part_number", "member_count", "members", "source_count", "existing_db_match", "recommended_master", "recommendation_reason", "status"],
    masterGroups);
  writeCsv(path.join(LOG_DIR, "part-number-existing-collisions.csv"),
    ["existing_number", "csv_number", "normalized", "existing_slug", "csv_slug", "classification"],
    existingCollisions);

  // ========== 4) Equipment 聚合 ==========
  // 生产 Equipment model 规范化索引
  const eqByNormModel = new Map<string, typeof equipmentRows[number]>();
  for (const e of equipmentRows) {
    const nm = normModel(e.model);
    if (nm && !eqByNormModel.has(nm)) eqByNormModel.set(nm, e);
  }

  // CSV relations 按 brand+equipment+model 聚合
  const relAgg = new Map<string, { brand: string; equipment: string; model: string; count: number; pnIds: Set<string> }>();
  for (const r of relRows) {
    const brand = resolveBrand(r.brand).canonical;
    const equipment = (r.equipment || "").trim();
    const model = (r.model || "").trim();
    if (!model) continue;
    const key = `${brand}|${equipment}|${model}`;
    if (!relAgg.has(key)) relAgg.set(key, { brand, equipment, model, count: 0, pnIds: new Set() });
    const agg = relAgg.get(key)!;
    agg.count++;
    if (r.pn_id) agg.pnIds.add(r.pn_id);
  }

  // 分类每个组合
  const missingRows: Record<string, string>[] = [];
  let exactExisting = 0, normalizedCandidate = 0, safeCreate = 0, reviewRequired = 0;
  for (const agg of Array.from(relAgg.values())) {
    // 生产 Equipment：brand+model 精确匹配
    const exact = equipmentRows.find((e) => normModel(e.brand) === normModel(agg.brand) && normModel(e.model) === normModel(agg.model));
    const normMatch = !exact ? eqByNormModel.get(normModel(agg.model)) : null;
    let classification: string;
    let recommendedAction: string;
    if (exact) {
      classification = "EXACT_EXISTING";
      recommendedAction = "直接关联";
      exactExisting++;
    } else if (normMatch && normModel(normMatch.brand) === normModel(agg.brand)) {
      classification = "NORMALIZED_MODEL_MATCH";
      recommendedAction = `格式差异候选：CSV "${agg.model}" vs 生产 "${normMatch.model}"，人工确认后关联`;
      normalizedCandidate++;
    } else {
      // 生产不存在。是否有厂家证据（VERIFIED+EXPLICIT+ACTIVE）→ SAFE_TO_CREATE
      const hasEvidence = relRows.some((r) =>
        resolveBrand(r.brand).canonical === agg.brand && (r.equipment || "").trim() === agg.equipment && (r.model || "").trim() === agg.model &&
        r.verification === "VERIFIED" && r.model_evidence === "EXPLICIT" && r.relation_status === "ACTIVE");
      if (hasEvidence) {
        classification = "SAFE_TO_CREATE";
        recommendedAction = "CSV 有厂家手册证据，可新建 Equipment 记录（本阶段不建）";
        safeCreate++;
      } else {
        classification = "REVIEW_REQUIRED";
        recommendedAction = "缺证据或品牌不一致，人工确认";
        reviewRequired++;
      }
    }
    missingRows.push({
      brand: agg.brand,
      equipment: agg.equipment,
      model: agg.model,
      relation_count: String(agg.count),
      unique_pn_count: String(agg.pnIds.size),
      existing_equipment_match: exact ? `${exact.brand} ${exact.model}` : normMatch ? `${normMatch.brand} ${normMatch.model} (候选)` : "",
      recommended_action: recommendedAction,
      classification,
    });
  }
  writeCsv(path.join(LOG_DIR, "equipment-master-missing.csv"),
    ["brand", "equipment", "model", "relation_count", "unique_pn_count", "existing_equipment_match", "recommended_action", "classification"],
    missingRows);

  // ========== 5) 四个数字 ==========
  const masterPnEstimate = singleCount + aliasReviewCount + existingReviewCount + trueConflictCount;
  const aliasGroups = aliasReviewCount;
  const aliasAuto = masterGroups.filter((g) => g.status === "FORMAT_ALIAS_REVIEW" && g.recommended_master !== "(人工)").length;
  const aliasManual = aliasGroups - aliasAuto;
  const uniqueModelCombos = relAgg.size;
  const missingModelsSet = new Set(
    missingRows.filter((r) => r.classification !== "EXACT_EXISTING").map((r) => `${r.brand}|${r.model}`)
  );

  console.log(`\n========== Stage 2.5 审计总账 ==========`);
  console.log(`【A】1596 raw → Master PN groups = ${masterPnEstimate}  (SINGLE=${singleCount}, FORMAT_ALIAS_REVIEW=${aliasReviewCount}, EXISTING_MATCH_REVIEW=${existingReviewCount}, TRUE_CONFLICT=${trueConflictCount})`);
  console.log(`【B】25 alias groups：可推荐 Master=${aliasAuto}, 仍需人工审核=${aliasManual}`);
  console.log(`【C】1613 relations → unique Brand+Equipment+Model 组合 = ${uniqueModelCombos}`);
  console.log(`【D】EQUIPMENT_NOT_FOUND 实际涉及 unique missing models = ${missingModelsSet.size}`);
  console.log(`  Equipment 分类：EXACT_EXISTING=${exactExisting}, NORMALIZED_MODEL_MATCH=${normalizedCandidate}, SAFE_TO_CREATE=${safeCreate}, REVIEW_REQUIRED=${reviewRequired}`);
  console.log(`【生产库】existing PartNumber=${existingCount}, PartNumber 新列=${pnTableHasNewCols}, PartNumberEquipment表=${partNumberEquipmentExists}, PartNumberAuditLog表=${partNumberAuditLogExists}`);
  console.log(`【CSV↔生产碰撞】NORMALIZED_MATCH_REVIEW=${existingCollisions.length}（应与 dry-run 的 NORMALIZED_MATCH_REVIEW 一致）`);
  console.log(`日志: logs/part-number-master-groups.csv / part-number-existing-collisions.csv / equipment-master-missing.csv`);
  console.log(`=== 只读审计完成，未写任何数据库 ===\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
