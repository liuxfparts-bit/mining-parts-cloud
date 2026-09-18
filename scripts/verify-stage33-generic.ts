/**
 * ============================================================
 * V3.1 Stage 3.3C1 — Generic Batch Verify（通用批次只读验证）
 *   npm run verify:stage33
 *
 * 以 logs/stage33-import-result.csv 作为"本次批次 manifest"，
 * 逐条从数据库实际读取并验证。
 *
 * 100% READ-ONLY：只查询，不 create/update/delete/upsert/raw SQL write。
 * fail-closed：manifest 无效 / DB query error / 任意验证失败 → FAIL + exit(1)。
 * ============================================================
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_FILE = path.join(ROOT, "logs", "stage33-import-result.csv");
const IMPORT_CSV = path.join(ROOT, "data", "part-numbers", "kuangpeiyun_partnumber_import_v3.csv");
const RELATIONS_CSV = path.join(ROOT, "data", "part-numbers", "kuangpeiyun_equipment_relations_v3.csv");

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

async function main() {
  console.log(`\n=== Stage 3.3 Generic Batch Verify ===\n`);

  // ===== 1. Manifest validation =====
  console.log(`--- Manifest validation ---`);
  const manifestFound = fs.existsSync(MANIFEST_FILE);
  console.log(`MANIFEST_FILE_FOUND = ${manifestFound ? "PASS" : "FAIL"}`);
  if (!manifestFound) {
    console.error(`[FAIL] Manifest file not found: ${MANIFEST_FILE}`);
    console.log(`MANIFEST_VALIDATION = FAIL`);
    console.log(`GENERIC_BATCH_VERIFY = FAIL`);
    process.exit(1);
  }

  let manifestRows: Record<string, string>[] = [];
  try {
    manifestRows = loadCsv(MANIFEST_FILE);
  } catch (e: any) {
    console.error(`[FAIL] Cannot parse manifest: ${(e && e.message || "").split("\n")[0]}`);
    console.log(`MANIFEST_VALIDATION = FAIL`);
    console.log(`GENERIC_BATCH_VERIFY = FAIL`);
    process.exit(1);
  }

  console.log(`MANIFEST_ROW_COUNT = ${manifestRows.length}`);
  if (manifestRows.length === 0) {
    console.error(`[FAIL] Manifest has 0 rows`);
    console.log(`MANIFEST_VALIDATION = FAIL`);
    console.log(`GENERIC_BATCH_VERIFY = FAIL`);
    process.exit(1);
  }

  // duplicate partNumber
  const pnSet = new Set<string>();
  let dupPnCount = 0;
  for (const r of manifestRows) {
    const pn = (r.partNumber || "").trim();
    if (pnSet.has(pn)) dupPnCount++; else pnSet.add(pn);
  }
  console.log(`MANIFEST_DUPLICATE_PARTNUMBER_COUNT = ${dupPnCount}`);

  // duplicate partNumberId
  const idSet = new Set<string>();
  let dupIdCount = 0;
  for (const r of manifestRows) {
    const id = (r.partNumberId || "").trim();
    if (idSet.has(id)) dupIdCount++; else idSet.add(id);
  }
  console.log(`MANIFEST_DUPLICATE_ID_COUNT = ${dupIdCount}`);

  // required fields + action + status
  let requiredFieldsValid = true;
  let actionValid = true;
  let statusValid = true;
  const REQUIRED = ["partNumber", "partNumberId", "normalizedPartNumber", "action", "status"];
  for (const r of manifestRows) {
    for (const fld of REQUIRED) {
      if (!r[fld] || !String(r[fld]).trim()) {
        requiredFieldsValid = false;
        console.error(`  [MANIFEST_FIELD_FAIL] PN=${r.partNumber || "(empty)"} missing field: ${fld}`);
      }
    }
    if (r.action && r.action !== "CREATE") {
      actionValid = false;
      console.error(`  [MANIFEST_ACTION_FAIL] PN=${r.partNumber} action=${r.action}`);
    }
    if (r.status && r.status !== "OK") {
      statusValid = false;
      console.error(`  [MANIFEST_STATUS_FAIL] PN=${r.partNumber} status=${r.status}`);
    }
  }
  console.log(`MANIFEST_REQUIRED_FIELDS_VALID = ${requiredFieldsValid ? "PASS" : "FAIL"}`);
  console.log(`MANIFEST_ACTION_VALID = ${actionValid ? "PASS" : "FAIL"}`);
  console.log(`MANIFEST_STATUS_VALID = ${statusValid ? "PASS" : "FAIL"}`);

  const manifestValid = dupPnCount === 0 && dupIdCount === 0 && requiredFieldsValid && actionValid && statusValid;
  console.log(`MANIFEST_VALIDATION = ${manifestValid ? "PASS" : "FAIL"}`);
  if (!manifestValid) {
    console.log(`GENERIC_BATCH_VERIFY = FAIL`);
    process.exit(1);
  }

  // ===== 2. 加载 V3 master CSV（用于 category/evidence/equipment expected）=====
  const pnRows = loadCsv(IMPORT_CSV);
  const relRows = loadCsv(RELATIONS_CSV);

  // partNumber → CSV row 映射
  const csvByNumber = new Map<string, Record<string, string>>();
  for (const r of pnRows) {
    const n = (r.part_number || "").trim();
    if (n) csvByNumber.set(n, r);
  }
  // pn_id → equipment models
  const relByPnId = new Map<string, string[]>();
  for (const r of relRows) {
    const pnId = (r.pn_id || "").trim();
    const model = (r.model || "").trim();
    if (!pnId || !model) continue;
    if (!relByPnId.has(pnId)) relByPnId.set(pnId, []);
    relByPnId.get(pnId)!.push(model);
  }

  // ===== 3. 逐条数据库验证 =====
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  let foundCount = 0;
  let missingCount = 0;
  let identityValid = true;
  let statusValidDb = true;
  let categoryValid = true;
  let evidenceValid = true;
  let equipmentValid = true;
  let auditValid = true;
  let queryErrorCount = 0;

  console.log(`\n--- 逐条验证（${manifestRows.length} 条）---`);

  for (const m of manifestRows) {
    const manifestNumber = (m.partNumber || "").trim();
    const manifestId = parseInt((m.partNumberId || "").trim(), 10);
    const manifestNorm = (m.normalizedPartNumber || "").trim();
    const manifestRelCount = parseInt((m.equipmentRelationsCreated || "0").trim(), 10);

    const csvRow = csvByNumber.get(manifestNumber);
    const expectedCategory = csvRow?.category || "";
    const expectedModelEvidence = csvRow?.model_evidence || "";
    const expectedConfidence = csvRow?.confidence || "";
    const expectedLastVerified = csvRow?.last_verified_date || "";
    const expectedModels = csvRow ? (relByPnId.get(csvRow.pn_id) || []) : [];

    let rowIdentity = "FAIL";
    let rowStatus = "FAIL";
    let rowCategory = "FAIL";
    let rowEvidence = "FAIL";
    let rowEquipment = "FAIL";
    let rowAudit = "FAIL";
    let actualModels: string[] = [];

    try {
      const existing = await prisma.partNumber.findUnique({
        where: { number: manifestNumber },
        select: {
          id: true, number: true, normalizedPartNumber: true,
          verificationStatus: true, publishStatus: true, verified: true,
          category: true, modelEvidence: true, confidence: true, lastVerifiedAt: true,
          equipmentRelations: { select: { equipmentModel: { select: { model: true } } } },
          auditLogs: { select: { action: true, reason: true, newVerification: true, newPublishStatus: true } },
        },
      });

      if (!existing) {
        missingCount++;
        console.log(`  [MISSING] ${manifestNumber} (manifest id=${manifestId})`);
        identityValid = false;
        continue;
      }
      foundCount++;

      // Identity: number + id + normalizedPartNumber 全部匹配
      const idMatch = existing.id === manifestId;
      const numberMatch = existing.number === manifestNumber;
      const normMatch = existing.normalizedPartNumber === manifestNorm;
      rowIdentity = (idMatch && numberMatch && normMatch) ? "PASS" : "FAIL";
      if (rowIdentity === "FAIL") {
        identityValid = false;
        console.log(`  [IDENTITY_FAIL] ${manifestNumber} manifestId=${manifestId} dbId=${existing.id} dbNorm=${existing.normalizedPartNumber} manifestNorm=${manifestNorm}`);
      }

      // Status
      const stOk = existing.verificationStatus === "VERIFIED" && existing.publishStatus === "READY" && existing.verified === true;
      rowStatus = stOk ? "PASS" : "FAIL";
      if (!stOk) {
        statusValidDb = false;
        console.log(`  [STATUS_FAIL] ${manifestNumber} verStatus=${existing.verificationStatus} pubStatus=${existing.publishStatus} verified=${existing.verified}`);
      }

      // Category
      rowCategory = existing.category === expectedCategory ? "PASS" : "FAIL";
      if (rowCategory === "FAIL") {
        categoryValid = false;
        console.log(`  [CATEGORY_FAIL] ${manifestNumber} expected=${expectedCategory} actual=${existing.category}`);
      }

      // Evidence semantics (Stage 3.2E: CSV有值→必须一致; CSV无值→schema default/null)
      let evOk = true;
      if (expectedModelEvidence) {
        if (existing.modelEvidence !== expectedModelEvidence) { evOk = false; }
      } else {
        if (existing.modelEvidence !== "NOT_EXPLICIT" && existing.modelEvidence !== null) { evOk = false; }
      }
      if (expectedConfidence) {
        if (existing.confidence !== expectedConfidence) { evOk = false; }
      } else {
        if (existing.confidence !== "MEDIUM" && existing.confidence !== null) { evOk = false; }
      }
      if (expectedLastVerified) {
        if (!existing.lastVerifiedAt) { evOk = false; }
      } else {
        if (existing.lastVerifiedAt !== null) { evOk = false; }
      }
      rowEvidence = evOk ? "PASS" : "FAIL";
      if (!evOk) {
        evidenceValid = false;
        console.log(`  [EVIDENCE_FAIL] ${manifestNumber} expected modelEv=${expectedModelEvidence || "NOT_EXPLICIT(default)"} conf=${expectedConfidence || "MEDIUM(default)"} lastVer=${expectedLastVerified || "null"} | actual modelEv=${existing.modelEvidence} conf=${existing.confidence} lastVer=${existing.lastVerifiedAt}`);
      }

      // Equipment relations: 集合完全相等
      actualModels = existing.equipmentRelations.map((er: any) => er.equipmentModel.model);
      const expectedSet = new Set(expectedModels);
      const actualSet = new Set(actualModels);
      const setsEqual = expectedSet.size === actualSet.size && Array.from(expectedSet).every((m) => actualSet.has(m));
      const manifestCountMatch = actualModels.length === manifestRelCount;
      rowEquipment = (setsEqual && manifestCountMatch) ? "PASS" : "FAIL";
      if (rowEquipment === "FAIL") {
        equipmentValid = false;
        console.log(`  [EQUIPMENT_FAIL] ${manifestNumber} expected=[${expectedModels.join(",")}] actual=[${actualModels.join(",")}] manifestRelCount=${manifestRelCount} actualCount=${actualModels.length}`);
      }

      // Audit: 必须存在本次要求的精确 audit
      const hasExactAudit = existing.auditLogs.some((a: any) =>
        a.action === "IMPORT_CREATE"
        && a.reason && a.reason.includes("V3.1 verified Sandvik ED10/LS190 import")
        && a.newVerification === "VERIFIED"
        && a.newPublishStatus === "READY");
      rowAudit = hasExactAudit ? "PASS" : "FAIL";
      if (!hasExactAudit) {
        auditValid = false;
        console.log(`  [AUDIT_FAIL] ${manifestNumber} no exact IMPORT_CREATE audit (action=IMPORT_CREATE + reason contains V3.1 verified Sandvik ED10/LS190 import + newVerification=VERIFIED + newPublishStatus=READY)`);
      }

      if (rowIdentity === "PASS" && rowStatus === "PASS" && rowCategory === "PASS" && rowEvidence === "PASS" && rowEquipment === "PASS" && rowAudit === "PASS") {
        console.log(`  [OK] ${manifestNumber} id=${existing.id} identity=PASS status=PASS category=PASS evidence=PASS equipment=PASS expected=[${expectedModels.join(",")}] actual=[${actualModels.join(",")}] audit=PASS`);
      }
    } catch (e: any) {
      queryErrorCount++;
      identityValid = false;
      console.error(`  [QUERY_ERROR] ${manifestNumber}: ${(e && e.message || "").split("\n")[0]}`);
    }
  }

  await prisma.$disconnect();

  // ===== 4. 汇总 =====
  console.log(`\n=== Stage 3.3 Generic Batch Verify 汇总 ===`);
  console.log(`MANIFEST_FILE_FOUND = PASS`);
  console.log(`MANIFEST_ROW_COUNT = ${manifestRows.length}`);
  console.log(`MANIFEST_DUPLICATE_PARTNUMBER_COUNT = ${dupPnCount}`);
  console.log(`MANIFEST_DUPLICATE_ID_COUNT = ${dupIdCount}`);
  console.log(`MANIFEST_REQUIRED_FIELDS_VALID = PASS`);
  console.log(`MANIFEST_VALIDATION = PASS`);
  console.log(``);
  console.log(`TARGET_BATCH_EXPECTED = ${manifestRows.length}`);
  console.log(`TARGET_BATCH_FOUND = ${foundCount}`);
  console.log(`TARGET_BATCH_MISSING = ${missingCount}`);
  console.log(`QUERY_ERROR_COUNT = ${queryErrorCount}`);
  console.log(``);
  console.log(`TARGET_IDENTITY_VALID = ${identityValid ? "PASS" : "FAIL"}`);
  console.log(`TARGET_STATUS_VALID = ${statusValidDb ? "PASS" : "FAIL"}`);
  console.log(`TARGET_CATEGORY_VALID = ${categoryValid ? "PASS" : "FAIL"}`);
  console.log(`TARGET_EVIDENCE_VALID = ${evidenceValid ? "PASS" : "FAIL"}`);
  console.log(`TARGET_EQUIPMENT_RELATIONS_VALID = ${equipmentValid ? "PASS" : "FAIL"}`);
  console.log(`TARGET_AUDIT_VALID = ${auditValid ? "PASS" : "FAIL"}`);
  console.log(``);
  console.log(`DATABASE_WRITES = 0 (READ-ONLY verification)`);

  const allPass = foundCount === manifestRows.length && missingCount === 0 && queryErrorCount === 0
    && identityValid && statusValidDb && categoryValid && evidenceValid && equipmentValid && auditValid;
  console.log(`GENERIC_BATCH_VERIFY = ${allPass ? "PASS" : "FAIL"}\n`);

  if (!allPass) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
export {};
