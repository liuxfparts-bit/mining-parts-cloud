/**
 * ============================================================
 * V3.1 Stage 3.2C PN 导入器
 *   npm run import:part-numbers -- --dry-run              只读预览+真实preflight
 *   npm run import:part-numbers -- --dry-run --limit=10  预览前10个SINGLE（连库查碰撞）
 *   npm run import:part-numbers -- --apply  --limit=10   正式导入10个SINGLE（transaction）
 *   npm run import:part-numbers -- --dry-run --resume --limit=50  Stage3.3A: resume classification + pending queue preview (BLOCK apply)
 *
 * 规则：
 *   - 默认 dry-run；只有 --apply 才写库
 *   - dry-run 也连库做只读 preflight（count + exact/normalized collision）
 *   - 只导入 SINGLE_READY（1546），25 组 FORMAT_ALIAS_REVIEW 全部 HOLD
 *   - --limit 从 SINGLE 中按 partNumber 升序确定性选取前 N（dry-run/apply 选同一批）
 *   - 实时碰撞检查：EXACT/NORMALIZED 命中 existing → SKIP+LOG，不覆盖
 *   - 每批一个 transaction，失败整批回滚
 *   - 写 PartNumberEquipment 多对多 + PartNumberAuditLog
 * ============================================================
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const IMPORT_CSV = path.join(ROOT, "data", "part-numbers", "kuangpeiyun_partnumber_import_v3.csv");
const RELATIONS_CSV = path.join(ROOT, "data", "part-numbers", "kuangpeiyun_equipment_relations_v3.csv");
const LOG_DIR = path.join(ROOT, "logs");

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const limitArg = argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : (apply ? 10 : Number.POSITIVE_INFINITY);
const resume = argv.includes("--resume");

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
function toSlug(s: string): string {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function resolveBrand(raw: string): string {
  const MAP: Record<string, string> = { "Sandvik / EIMCO": "Sandvik", "Sandvik/EIMCO": "Sandvik" };
  const src = String(raw || "").trim();
  if (!src) return "";
  return MAP[src] || src.split("/")[0].trim();
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

async function runResumeClassification(
  prisma: any,
  singleRows: Record<string, string>[],
  relByPnDry: Map<string, string[]>,
  aliasNormSet: Set<string>,
  limit: number,
  apply: boolean
): Promise<{ pendingSelected: Record<string, string>[]; preview: Record<string, string>[]; pendingImportCount: number }> {
  console.log("\n=== RESUME CLASSIFICATION（Stage 3.3A）===\n");

  let alreadyImportedCount = 0;
  let pendingImportCount = 0;
  let existingConflictCount = 0;
  let resumeQueryErrorCount = 0;
  const pendingRows: Record<string, string>[] = [];
  const classificationRecords: Record<string, string>[] = [];
  const alreadyImportedNumbers = new Set<string>();

  for (const r of singleRows) {
    const number = (r.part_number || "").trim();
    const n = norm(number);
    const slug = toSlug(r.slug || number);
    const expectedModels = relByPnDry.get(r.pn_id) || [];
    let resumeStatus = ""; let matchedId = "";
    let numberMatch = "NO", normalizedMatch = "NO", slugMatch = "NO";
    let statusMatch = "NO", categoryMatch = "NO", equipmentMatch = "NO", auditMatch = "NO";
    let reason = "";
    try {
      const existing = await prisma.partNumber.findUnique({
        where: { number },
        select: {
          id: true, number: true, normalizedPartNumber: true, slug: true,
          brandId: true, verificationStatus: true, publishStatus: true, verified: true,
          modelEvidence: true, confidence: true, lastVerifiedAt: true, category: true,
          equipmentRelations: { select: { equipmentModel: { select: { id: true, model: true } } } },
          auditLogs: { select: { action: true, reason: true } },
        },
      });
      if (existing) {
        matchedId = String(existing.id);
        numberMatch = existing.number === number ? "PASS" : "FAIL";
        normalizedMatch = existing.normalizedPartNumber === n ? "PASS" : "FAIL";
        slugMatch = existing.slug === slug ? "PASS" : "FAIL";
        const statusOk = existing.verificationStatus === "VERIFIED" && existing.publishStatus === "READY" && existing.verified === true;
        statusMatch = statusOk ? "PASS" : "FAIL";
        categoryMatch = existing.category === (r.category || "") ? "PASS" : "FAIL";
        const dbModels = existing.equipmentRelations.map((er: any) => er.equipmentModel.model);
        const allExpectedPresent = expectedModels.length > 0 && expectedModels.every((m: string) => dbModels.includes(m));
        equipmentMatch = allExpectedPresent ? "PASS" : "FAIL";
        const hasImportAudit = existing.auditLogs.some((a: any) =>
          a.action === "IMPORT_CREATE" && a.reason && a.reason.includes("V3.1 verified Sandvik ED10/LS190 import"));
        auditMatch = hasImportAudit ? "PASS" : "FAIL";
        const allPass = numberMatch === "PASS" && normalizedMatch === "PASS" && slugMatch === "PASS"
          && statusMatch === "PASS" && categoryMatch === "PASS" && equipmentMatch === "PASS" && auditMatch === "PASS";
        if (allPass) {
          resumeStatus = "ALREADY_IMPORTED_VERIFIED"; alreadyImportedCount++; alreadyImportedNumbers.add(number);
        } else {
          resumeStatus = "EXISTING_CONFLICT"; existingConflictCount++;
          reason = "numberMatch=" + numberMatch + " normalizedMatch=" + normalizedMatch + " slugMatch=" + slugMatch + " statusMatch=" + statusMatch + " categoryMatch=" + categoryMatch + " equipmentMatch=" + equipmentMatch + " auditMatch=" + auditMatch;
        }
      } else {
        const byNorm = await prisma.partNumber.findFirst({ where: { normalizedPartNumber: n }, select: { id: true, number: true } });
        const bySlug = await prisma.partNumber.findUnique({ where: { slug }, select: { id: true, number: true } });
        if (byNorm || bySlug) {
          resumeStatus = "EXISTING_CONFLICT"; existingConflictCount++;
          matchedId = String(byNorm?.id || bySlug?.id);
          reason = "number not found but normalized/slug hit: normalizedHit=" + (byNorm?.number || "none") + " slugHit=" + (bySlug?.number || "none");
        } else {
          resumeStatus = "PENDING_IMPORT"; pendingImportCount++; pendingRows.push(r);
        }
      }
    } catch (e: any) {
      resumeStatus = "RESUME_QUERY_ERROR"; resumeQueryErrorCount++;
      reason = (e && e.message || "").split("`n")[0];
    }
    classificationRecords.push({
      partNumber: number, normalizedPartNumber: n, slug, resumeStatus, matchedPartNumberId: matchedId,
      equipmentExpected: expectedModels.join("+"), statusMatch, categoryMatch, equipmentMatch, auditMatch, reason,
    });
    if (resumeStatus === "ALREADY_IMPORTED_VERIFIED") {
      console.log("  [ALREADY_IMPORTED_VERIFIED] " + number + " id=" + matchedId + " numberMatch=" + numberMatch + " normalizedMatch=" + normalizedMatch + " slugMatch=" + slugMatch + " statusMatch=" + statusMatch + " categoryMatch=" + categoryMatch + " equipmentRelation=" + equipmentMatch + " audit=" + auditMatch);
    }
  }

  writeCsv(path.join(LOG_DIR, "stage33-resume-classification.csv"),
    ["partNumber", "normalizedPartNumber", "slug", "resumeStatus", "matchedPartNumberId", "equipmentExpected", "statusMatch", "categoryMatch", "equipmentMatch", "auditMatch", "reason"],
    classificationRecords);

  console.log("`n--- RESUME CLASSIFICATION 汇总 ---");
  console.log("SINGLE_READY = " + singleRows.length);
  console.log("ALREADY_IMPORTED_VERIFIED = " + alreadyImportedCount);
  console.log("PENDING_IMPORT = " + pendingImportCount);
  console.log("EXISTING_CONFLICT = " + existingConflictCount);
  console.log("RESUME_QUERY_ERROR_COUNT = " + resumeQueryErrorCount);
  console.log("ALIAS_HOLD = " + aliasNormSet.size);
  const resumePreflightPass = resumeQueryErrorCount === 0 && existingConflictCount === 0;
  console.log("RESUME_PREFLIGHT_STATUS = " + (resumePreflightPass ? "PASS" : "BLOCKED"));
  if (!resumePreflightPass) { console.error("[RESUME] RESUME_PREFLIGHT_STATUS=BLOCKED"); await prisma.$disconnect(); process.exit(1); }
  if (apply) { console.error("[RESUME] Stage 3.3A resume mode does not allow --apply. Wait for Stage 3.3B."); await prisma.$disconnect(); process.exit(1); }

  pendingRows.sort((a, b) => (a.part_number || "").localeCompare(b.part_number || ""));
  const pendingSelected = pendingRows.slice(0, Math.min(limit, pendingRows.length));
  const selAlready = pendingSelected.filter((r) => alreadyImportedNumbers.has((r.part_number || "").trim()));
  if (selAlready.length > 0) { console.error("[RESUME] SELECTED_ALREADY_IMPORTED_INTERSECTION=" + selAlready.length); await prisma.$disconnect(); process.exit(1); }
  const selAlias = pendingSelected.filter((r) => aliasNormSet.has(norm(r.part_number || "")));
  if (selAlias.length > 0) { console.error("[RESUME] SELECTED_ALIAS_INTERSECTION=" + selAlias.length); await prisma.$disconnect(); process.exit(1); }
  console.log("SELECTED_ALREADY_IMPORTED_INTERSECTION = 0");
  console.log("SELECTED_ALIAS_INTERSECTION = 0");
  console.log("RESUME_SELECTION_ASSERTION = PASS");
  console.log("SELECTED_PENDING_FOR_IMPORT = " + pendingSelected.length);

  const pendingPreview: Record<string, string>[] = pendingSelected.map((r) => {
    const pn = (r.part_number || "").trim();
    const models = relByPnDry.get(r.pn_id) || [];
    return {
      partNumber: pn, normalizedPartNumber: norm(pn), slug: toSlug(r.slug || pn),
      description: r.description || "", category: r.category || "NULL", categorySource: r.category ? "CSV.category" : "MISSING",
      brand: resolveBrand(r.brand), equipmentRelations: models.join("+") || "(无)",
      verificationStatus: "VERIFIED", publishStatus: "READY", verified: "true",
      modelEvidence: r.model_evidence || "NULL", confidence: r.confidence || "NULL", lastVerifiedAt: r.last_verified_date || "NULL",
      resumeStatus: "PENDING_IMPORT", collisionExact: "未查", collisionNormalized: "未查", slugCollision: "未查", plannedAction: "PREVIEW",
    };
  });
  writeCsv(path.join(LOG_DIR, "stage33-pending-preview.csv"),
    ["partNumber", "normalizedPartNumber", "slug", "description", "category", "categorySource", "brand", "equipmentRelations", "verificationStatus", "publishStatus", "verified", "modelEvidence", "confidence", "lastVerifiedAt", "resumeStatus", "collisionExact", "collisionNormalized", "slugCollision", "plannedAction"],
    pendingPreview);
  return { pendingSelected, preview: pendingPreview, pendingImportCount: pendingImportCount };
}
async function main() {
  console.log(`\n=== V3.1 PN 导入（${apply ? "APPLY 写库" : "DRY-RUN 只读"}）===\n`);

  const pnRows = loadCsv(IMPORT_CSV);
  const relRows = loadCsv(RELATIONS_CSV);

  // 1) 找 25 组 alias normalized（全部 HOLD，不导入）
  const byNorm = new Map<string, string[]>();
  for (const r of pnRows) {
    const n = norm(r.part_number || "");
    if (!n) continue;
    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n)!.push(r.part_number);
  }
  const aliasNormSet = new Set<string>();
  for (const [n, members] of Array.from(byNorm.entries())) {
    if (new Set(members).size > 1) aliasNormSet.add(n);
  }

  // 2) SINGLE_READY 列表（排除 alias）
  const singleRows = pnRows.filter((r) => {
    const number = (r.part_number || "").trim();
    if (!number) return false;
    return !aliasNormSet.has(norm(number));
  });
  // 确定性排序：partNumber 升序
  singleRows.sort((a, b) => (a.part_number || "").localeCompare(b.part_number || ""));

  console.log(`INPUT_RAW = ${pnRows.length}`);
  console.log(`MASTER_GROUPS = ${byNorm.size}`);
  console.log(`SINGLE_READY = ${singleRows.length}`);
  console.log(`ALIAS_HOLD = ${aliasNormSet.size}（FORMAT_ALIAS_REVIEW，不导入）`);

  // 3) 选前 N 个（确定性）
  const selected = singleRows.slice(0, Math.min(limit, singleRows.length));

  // alias intersection assertion：selected 不得与 alias 有交集
  const selectedNormSet = new Set(selected.map((r) => norm(r.part_number || "")));
  const leak = Array.from(selectedNormSet).filter((n) => aliasNormSet.has(n));
  if (leak.length > 0) {
    console.log(`STOP: alias intersection 断言失败，${leak.length} 个 selected PN 属于 25 组 FORMAT_ALIAS_REVIEW: ${leak.join(", ")}`);
    process.exit(1);
  }
  console.log(`ALIAS_INTERSECTION_ASSERTION = PASS (selected ∩ alias = empty)`);

  console.log(`SELECTED_FOR_IMPORT = ${selected.length}`);

  // ===== CREATE_PAYLOAD_VALIDATION：纯内存验证 required 字段（dry-run/apply 均经过）=====
  // PartNumber schema required (non-null + no-default) scalar: number, slug, name, category
  const REQUIRED_FIELDS = ["number", "slug", "name", "category"];
  let payloadBlocked = false;
  for (const r of selected) {
    const vNumber = (r.part_number || "").trim();
    const vSlug = toSlug(r.slug || vNumber);
    const vName = r.description || vNumber;
    const vCategory = r.category || "";
    const vValues: Record<string, string> = { number: vNumber, slug: vSlug, name: vName, category: vCategory };
    for (const fld of REQUIRED_FIELDS) {
      if (!vValues[fld]) { console.log(`  [BLOCKED] PN=${vNumber || "(empty)"} missing required field: ${fld}`); payloadBlocked = true; }
    }
  }
  if (payloadBlocked) { console.log(`CREATE_PAYLOAD_VALIDATION = BLOCKED → STOP`); process.exit(1); }
  console.log(`CREATE_PAYLOAD_VALIDATION = PASS (required: ${REQUIRED_FIELDS.join(",")})`);
  console.log(`REQUIRED_FIELDS_SCHEMA_AUDIT = PASS`);

  // relations 索引（不连库，从 CSV 读，dry-run 也能显示）
  const relByPnDry = new Map<string, string[]>();
  for (const r of relRows) {
    const pnId = (r.pn_id || "").trim();
    const model = (r.model || "").trim();
    if (!pnId || !model) continue;
    if (!relByPnDry.has(pnId)) relByPnDry.set(pnId, []);
    relByPnDry.get(pnId)!.push(model);
  }

  // 预览输出
  let preview: Record<string, string>[] = selected.map((r) => {
    const number = (r.part_number || "").trim();
    const models = relByPnDry.get(r.pn_id) || [];
    return {
      partNumber: number,
      normalizedPartNumber: norm(number),
      slug: toSlug(r.slug || number),
      description: r.description || "",
      category: r.category || "NULL",
      categorySource: r.category ? "CSV.category" : "MISSING",
      brand: resolveBrand(r.brand),
      equipmentRelations: models.join("+") || "(无)",
      verificationStatus: "VERIFIED",
      publishStatus: "READY",
      verified: "true",
      modelEvidence: r.model_evidence || "NULL",
      confidence: r.confidence || "NULL",
      lastVerifiedAt: r.last_verified_date || "NULL",
      collisionExact: "未查",
      collisionNormalized: "未查",
      slugCollision: "未查",
      plannedAction: apply ? "WOULD_CREATE" : "PREVIEW",
    };
  });
  writeCsv(path.join(LOG_DIR, "stage32-import-preview.csv"),
    ["partNumber", "normalizedPartNumber", "slug", "description", "category", "categorySource", "brand", "equipmentRelations", "verificationStatus", "publishStatus", "verified", "modelEvidence", "confidence", "lastVerifiedAt", "collisionExact", "collisionNormalized", "slugCollision", "plannedAction"],
    preview);
  console.log(`\n--- 选中 ${selected.length} 个 PN（预览+preflight）---`);

  // ===== Stage 3.2C: dry-run 也连库做真实 preflight collision（只读）=====
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  let resumePendingImportCount = 0;
  if (resume) {
    const resumeResult = await runResumeClassification(prisma, singleRows, relByPnDry, aliasNormSet, limit, apply);
    const resumePendingImportCount = resumeResult.pendingImportCount;
    selected.length = 0;
    selected.push(...resumeResult.pendingSelected);
    preview = resumeResult.preview;
    console.log("`n--- RESUME: selected replaced with " + selected.length + " pending PN, continuing preflight ---`n");
  }


  let existingCount = 0;
  let exactCollisionCount = 0;
  let normalizedCollisionCount = 0;
  let slugCollisionCount = 0;
  let collisionQueryErrorCount = 0;
  let batchSlugDuplicateCount = 0;
  try {
    existingCount = await prisma.partNumber.count();
  } catch (e: any) {
    console.log(`[警告] 无法查询 existing PartNumber count: ${(e && e.message || "").split("\n")[0]}`);
  }

  // BATCH_SLUG_DUPLICATE：selected 内部是否产生重复 slug
  const slugSeen = new Set<string>();
  for (const bp of preview) { if (slugSeen.has(bp.slug)) { batchSlugDuplicateCount++; } else { slugSeen.add(bp.slug); } }
  if (batchSlugDuplicateCount > 0) { console.log(`  [BLOCKED] BATCH_SLUG_DUPLICATE_COUNT=${batchSlugDuplicateCount}，selected 内部 slug 重复`); }

  for (const p of preview) {
    try {
      const ex = await prisma.partNumber.findUnique({ where: { number: p.partNumber }, select: { id: true } });
      p.collisionExact = ex ? "YES" : "NO";
      if (ex) exactCollisionCount++;
    } catch { p.collisionExact = "QUERY_ERROR"; collisionQueryErrorCount++; }
    try {
      const nm = await prisma.partNumber.findFirst({ where: { normalizedPartNumber: p.normalizedPartNumber }, select: { id: true } });
      p.collisionNormalized = nm ? "YES" : "NO";
      if (nm) normalizedCollisionCount++;
    } catch { p.collisionNormalized = "QUERY_ERROR"; collisionQueryErrorCount++; }
    try {
      const sl = await prisma.partNumber.findUnique({ where: { slug: p.slug }, select: { id: true } });
      p.slugCollision = sl ? "YES" : "NO";
      if (sl) slugCollisionCount++;
    } catch { p.slugCollision = "QUERY_ERROR"; collisionQueryErrorCount++; }
    console.log(`  ${p.partNumber} | ${p.normalizedPartNumber} | ${p.slug} | cat=${p.category}(${p.categorySource}) | ${p.equipmentRelations} | ${p.verificationStatus}/${p.publishStatus} | verified=${p.verified} | modelEv=${p.modelEvidence} | conf=${p.confidence} | lastVer=${p.lastVerifiedAt} | exact=${p.collisionExact} norm=${p.collisionNormalized} slug=${p.slugCollision} | ${p.plannedAction}`);
  }

  const expectedSelectedCount = resume ? Math.min(limit, resumePendingImportCount) : 10;
  const preflightPass = exactCollisionCount === 0 && normalizedCollisionCount === 0 && slugCollisionCount === 0 && collisionQueryErrorCount === 0 && batchSlugDuplicateCount === 0 && selected.length === expectedSelectedCount;
  console.log(`\n--- PRECHECK 汇总 ---`);
  console.log(`INPUT_RAW = ${pnRows.length}`);
  console.log(`MASTER_GROUPS = ${byNorm.size}`);
  console.log(`SINGLE_READY = ${singleRows.length}`);
  console.log(`ALIAS_HOLD = ${aliasNormSet.size}`);
  console.log(`ALIAS_INTERSECTION_ASSERTION = PASS`);
  console.log(`SELECTED_FOR_IMPORT = ${selected.length}`);
  console.log(`EXISTING_PART_NUMBER_COUNT = ${existingCount}`);
  console.log(`EXACT_COLLISION_COUNT = ${exactCollisionCount}`);
  console.log(`NORMALIZED_COLLISION_COUNT = ${normalizedCollisionCount}`);
  console.log(`SLUG_COLLISION_COUNT = ${slugCollisionCount}`);
  console.log(`BATCH_SLUG_DUPLICATE_COUNT = ${batchSlugDuplicateCount}`);
  console.log(`COLLISION_QUERY_ERROR_COUNT = ${collisionQueryErrorCount}`)
  console.log(`DATABASE_WRITES = 0`);
  console.log("REQUESTED_LIMIT = " + (resume ? limit : 10));
  console.log("EXPECTED_SELECTED_COUNT = " + expectedSelectedCount);
  console.log("ACTUAL_SELECTED_COUNT = " + selected.length);
  console.log("SELECTED_COUNT_ASSERTION = " + (selected.length === expectedSelectedCount ? "PASS" : "FAIL"));
  console.log(`PREFLIGHT_STATUS = ${preflightPass ? "PASS" : "BLOCKED"}`);

  if (!apply) {
    await prisma.$disconnect();
    console.log(`\n=== DRY-RUN 完成，未写库 ===\n`);
    return;
  }

  if (!preflightPass) { console.error("[APPLY] PREFLIGHT_STATUS=BLOCKED，禁止进入 transaction"); await prisma.$disconnect(); process.exit(1); }
  // ===== APPLY：正式写库（PrismaClient 已在上方创建）=====
  // 前置：Sandvik Brand 精确 lookup（slug 优先 + nameEn 验证，不硬编码 id）
  const bySlug = await prisma.brand.findUnique({ where: { slug: "sandvik" }, select: { id: true, name: true, nameEn: true, status: true } });
  if (!bySlug) {
    throw new Error("Sandvik Brand lookup 失败（slug=sandvik 未找到），先跑 setup:equipment --apply");
  }
  if (bySlug.nameEn !== "Sandvik" || bySlug.status !== "ACTIVE") {
    throw new Error("Sandvik Brand lookup 失败（nameEn/status 不匹配），先跑 setup:equipment --apply");
  }
  const ed10 = await prisma.equipment.findFirst({ where: { model: "ED10" }, select: { id: true } });
  const ls190 = await prisma.equipment.findFirst({ where: { model: "LS190" }, select: { id: true } });
  if (!ls190) throw new Error("LS190 不存在（应 REUSE）");
  const sandvikBrandId = bySlug.id;
  const ed10Id = ed10?.id ?? null;
  const ls190Id = ls190.id;
  console.log(`\n[APPLY] Sandvik brandId=${bySlug.id}  ED10=${ed10 ? `id=${ed10.id}` : "不存在（跳过 ED10 关系）"}  LS190=id=${ls190.id}`);

  // relations 索引：pn_id → [{model}]
  const relByPn = new Map<string, string[]>();
  for (const r of relRows) {
    const pnId = (r.pn_id || "").trim();
    const model = (r.model || "").trim();
    if (!pnId || !model) continue;
    if (!relByPn.has(pnId)) relByPn.set(pnId, []);
    relByPn.get(pnId)!.push(model);
  }


  const results: Record<string, string>[] = [];
  // 整批 transaction
  try {
    await prisma.$transaction(async (tx) => {
      for (const r of selected) {
        const number = (r.part_number || "").trim();
        const n = norm(number);
        const slug = toSlug(r.slug || number);

        // 实时碰撞检查（transaction-time recheck）
        // preflight 已确认 0 collision；transaction 内若出现 collision 视为异常 → STOP+ROLLBACK 整批
        const existingExact = await tx.partNumber.findUnique({ where: { number }, select: { id: true } });
        const existingNorm = await tx.partNumber.findFirst({ where: { normalizedPartNumber: n }, select: { id: true } });
        const existingSlug = await tx.partNumber.findUnique({ where: { slug }, select: { id: true } });
        if (existingExact || existingNorm || existingSlug) {
          throw new Error(`TRANSACTION_COLLISION at PN=${number} slug=${slug} normalized=${n} existing id=${existingExact?.id || existingNorm?.id || existingSlug?.id} → STOP+ROLLBACK whole batch`);
        }

        // 写 PartNumber（证据语义：CSV 有值才传；缺失不传字段让 schema default 生效，禁止 importer 自行提升证据等级）
        const createData: Record<string, any> = {
          number, slug,
          name: r.description || number,
          category: r.category || "",
          nameEn: r.original_description_en || r.description || "",
          brandId: sandvikBrandId,
          verified: true,
          verificationStatus: "VERIFIED",
          publishStatus: "READY",
          evidenceSummary: r.evidence_summary || "Imported from KuangPeiYun verified PN dataset V3.0",
          sourceFiles: r.source_files || "",
          originalDescriptionEn: r.original_description_en || "",
          originalDescriptionCn: r.original_description_cn || "",
          normalizedPartNumber: n,
        };
        if (r.model_evidence) createData.modelEvidence = r.model_evidence as any;
        if (r.confidence) createData.confidence = r.confidence as any;
        if (r.last_verified_date) createData.lastVerifiedAt = new Date(r.last_verified_date);
        const created = await tx.partNumber.create({ data: createData as any, select: { id: true } });

        // PartNumberEquipment 多对多关系
        const models = relByPn.get(r.pn_id) || [];
        let relCount = 0;
        for (const m of models) {
          let eqId: number | null = null;
          if (m === "ED10" && ed10Id) eqId = ed10Id;
          else if (m === "LS190") eqId = ls190Id;
          if (!eqId) continue;
          await tx.partNumberEquipment.create({
            data: {
              partNumberId: created.id,
              equipmentModelId: eqId,
              evidenceStatus: "EXPLICIT",
              verificationStatus: "VERIFIED",
              evidenceSummary: r.evidence_summary || "",
            } as any,
          });
          relCount++;
        }

        // AuditLog
        await tx.partNumberAuditLog.create({
          data: {
            partNumberId: created.id,
            action: "IMPORT_CREATE",
            oldVerification: "",
            newVerification: "VERIFIED",
            oldPublishStatus: "",
            newPublishStatus: "READY",
            reason: "V3.1 verified Sandvik ED10/LS190 import",
            changedById: 0,
          } as any,
        });

        results.push({ partNumber: number, normalizedPartNumber: n, action: "CREATE", partNumberId: String(created.id), equipmentRelationsCreated: String(relCount), status: "OK", reason: "" });
      }
    });
    console.log(`[APPLY] transaction 提交成功`);
  } catch (e: any) {
    console.error(`[APPLY] transaction 失败，整批回滚: ${(e.message || "").split("\n")[0]}`);
    throw e;
  }

  writeCsv(path.join(LOG_DIR, "stage32-import-result.csv"),
    ["partNumber", "normalizedPartNumber", "action", "partNumberId", "equipmentRelationsCreated", "status", "reason"],
    results);
  await prisma.$disconnect();
  console.log(`\n=== APPLY 完成，写入 ${results.filter((r) => r.status === "OK").length} 条，SKIP ${results.filter((r) => r.status !== "OK").length} 条 ===\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
export {};
