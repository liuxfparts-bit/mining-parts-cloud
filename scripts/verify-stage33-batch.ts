/**
 * ============================================================
 * V3.1 Stage 3.3B 只读验证脚本（第二批 50 条 PN）
 *   npm run verify:stage33-batch
 *
 * 100% READ-ONLY：只查询，不 create/update/delete。
 * 验证第二批 50 条（SINGLE_READY 按 partNumber 升序第 11–60 条）：
 *   - PartNumber 存在性
 *   - 状态字段（VERIFIED/READY/verified=true）
 *   - category 匹配 CSV
 *   - Equipment relations（106-03455 / 114-8516LFL 必须 ED10+LS190）
 *   - PartNumberAuditLog（action=IMPORT_CREATE, reason 含 V3.1 verified Sandvik ED10/LS190 import）
 * ============================================================
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const IMPORT_CSV = path.join(ROOT, "data", "part-numbers", "kuangpeiyun_partnumber_import_v3.csv");
const RELATIONS_CSV = path.join(ROOT, "data", "part-numbers", "kuangpeiyun_equipment_relations_v3.csv");

const EXPECTED_BEFORE = 174;
const BATCH_SIZE = 50;
const BATCH_START_INDEX = 10; // 跳过首批 10 条

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
  console.log(`\n=== Stage 3.3B 只读验证（第二批 ${BATCH_SIZE} 条）===\n`);

  const pnRows = loadCsv(IMPORT_CSV);
  const relRows = loadCsv(RELATIONS_CSV);

  // 计算 SINGLE_READY（排除 25 alias）
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
  const singleRows = pnRows.filter((r) => {
    const number = (r.part_number || "").trim();
    if (!number) return false;
    return !aliasNormSet.has(norm(number));
  });
  singleRows.sort((a, b) => (a.part_number || "").localeCompare(b.part_number || ""));

  // 第二批：索引 BATCH_START_INDEX 到 BATCH_START_INDEX+BATCH_SIZE-1
  const batch = singleRows.slice(BATCH_START_INDEX, BATCH_START_INDEX + BATCH_SIZE);
  console.log(`SINGLE_READY = ${singleRows.length}`);
  console.log(`BATCH_START_INDEX = ${BATCH_START_INDEX}`);
  console.log(`BATCH_SIZE = ${batch.length}`);
  console.log(`BATCH_FIRST = ${batch[0]?.part_number}`);
  console.log(`BATCH_LAST = ${batch[batch.length - 1]?.part_number}`);

  // relations 索引
  const relByPnId = new Map<string, string[]>();
  for (const r of relRows) {
    const pnId = (r.pn_id || "").trim();
    const model = (r.model || "").trim();
    if (!pnId || !model) continue;
    if (!relByPnId.has(pnId)) relByPnId.set(pnId, []);
    relByPnId.get(pnId)!.push(model);
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  let actualCount = 0;
  try {
    actualCount = await prisma.partNumber.count();
  } catch (e: any) {
    console.error(`[ERROR] 无法查询 PartNumber count: ${(e && e.message || "").split("\n")[0]}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const expectedAfter = EXPECTED_BEFORE + BATCH_SIZE;
  console.log(`\n--- Count 验证 ---`);
  console.log(`BEFORE_PART_NUMBER_COUNT = ${EXPECTED_BEFORE}`);
  console.log(`EXPECTED_AFTER_COUNT = ${expectedAfter}`);
  console.log(`ACTUAL_PART_NUMBER_COUNT = ${actualCount}`);
  console.log(`COUNT_MATCH = ${actualCount === expectedAfter ? "PASS" : "FAIL"}`);

  // 逐条验证
  let foundCount = 0;
  let missingCount = 0;
  let statusValid = true;
  let categoryValid = true;
  let equipmentValid = true;
  let auditValid = true;
  const missingList: string[] = [];

  console.log(`\n--- 逐条验证（${batch.length} 条）---`);
  for (const r of batch) {
    const number = (r.part_number || "").trim();
    const expectedCategory = r.category || "";
    const expectedModels = relByPnId.get(r.pn_id) || [];

    try {
      const existing = await prisma.partNumber.findUnique({
        where: { number },
        select: {
          id: true, number: true, verificationStatus: true, publishStatus: true, verified: true,
          category: true,
          equipmentRelations: { select: { equipmentModel: { select: { model: true } } } },
          auditLogs: { select: { action: true, reason: true } },
        },
      });

      if (!existing) {
        missingCount++;
        missingList.push(number);
        console.log(`  [MISSING] ${number}`);
        continue;
      }
      foundCount++;

      // 状态验证
      const statusOk = existing.verificationStatus === "VERIFIED" && existing.publishStatus === "READY" && existing.verified === true;
      if (!statusOk) {
        statusValid = false;
        console.log(`  [STATUS_FAIL] ${number} verStatus=${existing.verificationStatus} pubStatus=${existing.publishStatus} verified=${existing.verified}`);
      }

      // category 验证
      if (existing.category !== expectedCategory) {
        categoryValid = false;
        console.log(`  [CATEGORY_FAIL] ${number} db="${existing.category}" expected="${expectedCategory}"`);
      }

      // equipment relation 验证
      const dbModels = existing.equipmentRelations.map((er: any) => er.equipmentModel.model);
      const allExpectedPresent = expectedModels.length > 0 && expectedModels.every((m: string) => dbModels.includes(m));
      if (!allExpectedPresent) {
        equipmentValid = false;
        console.log(`  [EQUIPMENT_FAIL] ${number} expected=[${expectedModels.join(",")}] db=[${dbModels.join(",")}]`);
      }

      // audit 验证
      const hasImportAudit = existing.auditLogs.some((a: any) =>
        a.action === "IMPORT_CREATE" && a.reason && a.reason.includes("V3.1 verified Sandvik ED10/LS190 import"));
      if (!hasImportAudit) {
        auditValid = false;
        console.log(`  [AUDIT_FAIL] ${number} no IMPORT_CREATE audit with expected reason`);
      }

      if (statusOk && allExpectedPresent && hasImportAudit && existing.category === expectedCategory) {
        console.log(`  [OK] ${number} id=${existing.id} cat=${existing.category} equip=[${dbModels.join(",")}]`);
      }
    } catch (e: any) {
      console.error(`  [QUERY_ERROR] ${number}: ${(e && e.message || "").split("\n")[0]}`);
      missingCount++;
      missingList.push(number);
    }
  }

  // 双 equipment 专项验证
  console.log(`\n--- 双 Equipment 专项验证 ---`);
  const dualPns = ["106-03455", "114-8516LFL"];
  for (const pn of dualPns) {
    try {
      const existing = await prisma.partNumber.findUnique({
        where: { number: pn },
        select: { equipmentRelations: { select: { equipmentModel: { select: { model: true } } } } },
      });
      const dbModels = existing?.equipmentRelations.map((er: any) => er.equipmentModel.model) || [];
      const hasBoth = dbModels.includes("ED10") && dbModels.includes("LS190");
      console.log(`  ${pn}: models=[${dbModels.join(",")}] DUAL_ED10_LS190=${hasBoth ? "PASS" : "FAIL"}`);
      if (!hasBoth) equipmentValid = false;
    } catch (e: any) {
      console.log(`  ${pn}: QUERY_ERROR`);
      equipmentValid = false;
    }
  }

  // 汇总
  console.log(`\n--- 验证汇总 ---`);
  console.log(`TARGET_BATCH_EXPECTED = ${batch.length}`);
  console.log(`TARGET_BATCH_FOUND = ${foundCount}`);
  console.log(`TARGET_BATCH_MISSING = ${missingCount}`);
  if (missingList.length > 0) console.log(`MISSING_LIST = ${missingList.join(", ")}`);
  console.log(`TARGET_STATUS_VALID = ${statusValid ? "PASS" : "FAIL"}`);
  console.log(`TARGET_CATEGORY_VALID = ${categoryValid ? "PASS" : "FAIL"}`);
  console.log(`TARGET_EQUIPMENT_RELATIONS_VALID = ${equipmentValid ? "PASS" : "FAIL"}`);
  console.log(`TARGET_AUDIT_VALID = ${auditValid ? "PASS" : "FAIL"}`);

  const allPass = actualCount === expectedAfter && foundCount === batch.length && missingCount === 0
    && statusValid && categoryValid && equipmentValid && auditValid;
  console.log(`\nSTAGE33_BATCH_VERIFY = ${allPass ? "PASS" : "FAIL"}`);
  console.log(`DATABASE_WRITES = 0 (READ-ONLY verification)\n`);

  await prisma.$disconnect();
  if (!allPass) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
export {};
