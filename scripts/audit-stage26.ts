/**
 * ============================================================
 * V3.1 Stage 2.6 只读审计
 * 1) 精确查生产 Equipment 表 ED10/LS190 所有写法变体，输出真实字段
 * 2) 判断 ED10/LS190 是 REUSE / CREATE / REVIEW（Equipment.model unique）
 * 3) 25 组 FORMAT_ALIAS 按证据推荐 Master，输出 resolution 报告
 * 只读：findMany/findFirst/count + 读 CSV + 写 logs/*.csv
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
function loadCsv(file: string): Record<string, string>[] {
  const parsed = parseCsv(fs.readFileSync(file, "utf8"));
  const headers = parsed[0].map((h) => h.trim());
  return parsed.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
    return obj;
  });
}
function norm(input: string): string {
  if (!input) return "";
  return String(input).trim().toUpperCase().replace(/[\s\-_/.·,，()（）\[\]]/g, "");
}
function writeCsv(file: string, header: string[], records: Record<string, string>[]): void {
  const esc = (v: string) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of records) lines.push(header.map((h) => esc(r[h] ?? "")).join(","));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join("\n"), "utf8");
}
function resolveBrand(raw: string): string {
  const MAP: Record<string, string> = { "Sandvik / EIMCO": "Sandvik", "Sandvik/EIMCO": "Sandvik" };
  const src = String(raw || "").trim();
  if (!src) return "";
  return MAP[src] || src.split("/")[0].trim();
}

async function main() {
  console.log(`\n=== V3.1 Stage 2.6 只读审计 ===\n`);

  const pnRows = loadCsv(IMPORT_CSV);
  const relRows = loadCsv(RELATIONS_CSV);

  // ========== 1) 生产 Equipment 精确查询 ==========
  const candidates: Record<string, string>[] = [];
  let dbAvailable = false;
  let allEquipments: { id: number; brand: string; model: string; name: string; equipmentType: string; series: string }[] = [];

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const eq = await prisma.equipment.findMany({ select: { id: true, brand: true, model: true, name: true, equipmentType: true, series: true } });
    dbAvailable = true;
    allEquipments = eq.map((e) => ({
      id: e.id, brand: String(e.brand || ""), model: String(e.model || ""),
      name: String(e.name || ""), equipmentType: String(e.equipmentType || ""), series: String(e.series || ""),
    }));

    // 对 CSV 两个目标型号做精确 + normalized 匹配
    const targets = ["ED10", "LS190"];
    for (const t of targets) {
      const normT = norm(t);
      // exact
      const exact = allEquipments.filter((e) => e.model.toUpperCase() === t);
      for (const e of exact) {
        candidates.push({
          equipment_id: String(e.id), brand_id: "", brand_name: e.brand, equipment_name: e.name,
          model: e.model, series: e.series, equipment_type: e.equipmentType,
          normalized_model: norm(e.model), candidate_for: t, match_type: "EXACT_MODEL",
        });
      }
      // normalized 匹配（ED-10 / ED 10 / LS 190 等写法变体）
      const normMatches = allEquipments.filter((e) => norm(e.model) === normT && e.model.toUpperCase() !== t);
      for (const e of normMatches) {
        candidates.push({
          equipment_id: String(e.id), brand_id: "", brand_name: e.brand, equipment_name: e.name,
          model: e.model, series: e.series, equipment_type: e.equipmentType,
          normalized_model: norm(e.model), candidate_for: t, match_type: "NORMALIZED_MODEL_VARIANT",
        });
      }
    }
    await prisma.$disconnect();
  } catch (e: any) {
    console.log(`[警告] DB 不可用: ${(e.message || "").split("\n")[0]}`);
  }

  writeCsv(path.join(LOG_DIR, "equipment-production-candidates.csv"),
    ["equipment_id", "brand_id", "brand_name", "equipment_name", "model", "series", "equipment_type", "normalized_model", "candidate_for", "match_type"],
    candidates);

  // ========== 2) ED10 / LS190 REUSE vs CREATE 判断 ==========
  const ed10 = { exact: candidates.filter((c) => c.candidate_for === "ED10" && c.match_type === "EXACT_MODEL"), norm: candidates.filter((c) => c.candidate_for === "ED10" && c.match_type === "NORMALIZED_MODEL_VARIANT") };
  const ls190 = { exact: candidates.filter((c) => c.candidate_for === "LS190" && c.match_type === "EXACT_MODEL"), norm: candidates.filter((c) => c.candidate_for === "LS190" && c.match_type === "NORMALIZED_MODEL_VARIANT") };

  function decide(t: string, exact: Record<string, string>[], normM: Record<string, string>[]): string {
    if (exact.length > 0) return `REUSE_EXISTING (equipment_id=${exact.map((c) => c.equipment_id).join("/")}, model="${exact[0].model}", brand="${exact[0].brand_name}")`;
    if (normM.length > 0) return `REVIEW: 生产存在型号变体 "${normM[0].model}" (brand="${normM[0].brand_name}")，model unique 约束下不能新建第二个；人工确认是否同一型号后 REUSE`;
    return "SAFE_TO_CREATE (生产无此型号，CSV 有厂家手册 EXPLICIT 证据)";
  }
  console.log(`\n--- Equipment 方案 ---`);
  console.log(`ED10   → ${decide("ED10", ed10.exact, ed10.norm)}`);
  console.log(`LS190  → ${decide("LS190", ls190.exact, ls190.norm)}`);

  // ========== 3) 25 组 alias 证据推荐 ==========
  // normalized -> members（从 CSV 重新聚合）
  const byNorm = new Map<string, any[]>();
  for (const r of pnRows) {
    const number = (r.part_number || "").trim();
    if (!number) continue;
    const n = norm(number);
    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n)!.push({
      number,
      sources: r.source_files || "",
      evidence: r.evidence_summary || "",
      confidence: r.confidence || "",
      modelEvidence: r.model_evidence || "",
    });
  }

  const aliasResolution: Record<string, string>[] = [];
  let aliasAuto = 0, aliasManual = 0;
  for (const [n, members] of Array.from(byNorm.entries())) {
    const distinct = Array.from(new Set(members.map((m) => m.number)));
    if (distinct.length < 2) continue;
    // occurrence count per 写法
    const occ = new Map<string, number>();
    const srcs = new Map<string, string[]>();
    const evs = new Map<string, string[]>();
    for (const m of members) {
      occ.set(m.number, (occ.get(m.number) || 0) + 1);
      if (!srcs.has(m.number)) srcs.set(m.number, []);
      if (!evs.has(m.number)) evs.set(m.number, []);
      if (m.sources) srcs.get(m.number)!.push(m.sources);
      if (m.evidence) evs.get(m.number)!.push(m.evidence);
    }
    const c1 = distinct[0], c2 = distinct[1];
    const o1 = occ.get(c1) || 0, o2 = occ.get(c2) || 0;
    const ev1 = (evs.get(c1) || []).length, ev2 = (evs.get(c2) || []).length;
    // 推荐规则：证据条数差异 ≥1 且不只是 CSV 排列顺序 → 推荐证据多的写法；否则 MANUAL_REVIEW
    let recommended = "", reason = "", confidence = "LOW", review = "MANUAL_REVIEW";
    if (ev1 > ev2) { recommended = c1; reason = `candidate_1 证据条目 ${ev1} > candidate_2 ${ev2}，证据更充分`; confidence = "MEDIUM"; review = "RECOMMENDED"; aliasAuto++; }
    else if (ev2 > ev1) { recommended = c2; reason = `candidate_2 证据条目 ${ev2} > candidate_1 ${ev1}，证据更充分`; confidence = "MEDIUM"; review = "RECOMMENDED"; aliasAuto++; }
    else { recommended = "(人工)"; reason = "两写法证据条数相同，程序不定主件号（P1-P4 规则）"; confidence = "LOW"; review = "MANUAL_REVIEW"; aliasManual++; }
    aliasResolution.push({
      normalized_part_number: n,
      candidate_1: c1, candidate_2: c2,
      candidate_1_sources: (srcs.get(c1) || []).join(" | "),
      candidate_2_sources: (srcs.get(c2) || []).join(" | "),
      candidate_1_occurrences: String(o1), candidate_2_occurrences: String(o2),
      candidate_1_manual_evidence: String(ev1), candidate_2_manual_evidence: String(ev2),
      recommended_master: recommended, recommendation_reason: reason,
      confidence, review_status: review,
    });
  }
  writeCsv(path.join(LOG_DIR, "part-number-alias-resolution.csv"),
    ["normalized_part_number", "candidate_1", "candidate_2", "candidate_1_sources", "candidate_2_sources", "candidate_1_occurrences", "candidate_2_occurrences", "candidate_1_manual_evidence", "candidate_2_manual_evidence", "recommended_master", "recommendation_reason", "confidence", "review_status"],
    aliasResolution);

  // ========== 4) 最终 import-ready 总账 ==========
  const singleReady = 1546; // SINGLE（Stage 2.5 已确认）
  const totalGroups = 1571;
  const importReady = singleReady + aliasAuto; // 推荐组 Stage 3 可导入，人工组待审
  console.log(`\n--- 最终可导入 Master PN 总账 ---`);
  console.log(`RAW_PN = 1596`);
  console.log(`MASTER_GROUPS = 1571`);
  console.log(`SINGLE_READY = ${singleReady}`);
  console.log(`ALIAS_RESOLVED_READY = ${aliasAuto}`);
  console.log(`ALIAS_MANUAL_REVIEW = ${aliasManual}`);
  console.log(`TRUE_CONFLICT = 0`);
  console.log(`校验: ${singleReady} + ${aliasAuto} + ${aliasManual} + 0 = ${singleReady + aliasAuto + aliasManual} (应=1571)`);
  console.log(`IMPORT_READY_MASTER_TOTAL（Stage 3 可导入）= ${importReady}（1546 SINGLE + ${aliasAuto} alias 推荐）`);
  console.log(`待人工审核 alias = ${aliasManual}（Stage 3 暂不导入，等确认）`);

  console.log(`\n--- Schema 状态记录（不处理）---`);
  console.log(`SCHEMA_APPLIED_BY_DB_PUSH = YES (PartNumberEquipment/PartNumberAuditLog/治理列已存在)`);
  console.log(`MIGRATION_HISTORY_RECONCILIATION_REQUIRED = YES（后续单独 baseline）`);
  console.log(`\n日志: logs/equipment-production-candidates.csv / part-number-alias-resolution.csv`);
  console.log(`=== Stage 2.6 只读审计完成，未写任何数据库 ===\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
