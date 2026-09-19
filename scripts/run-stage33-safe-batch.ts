/**
 * ============================================================
 * V3.1 Stage 3.3C2 — Safe Batch Runner
 *   npm run batch:stage33 -- --limit=100
 *
 * 薄 orchestration layer：不复制 importer / verify 业务逻辑。
 * 严格执行：Dry-run PASS → Apply COMMITTED → Manifest match → Verify PASS → STOP
 * 任何一步 FAIL → STOP IMMEDIATELY，不自动 retry Apply，不自动进入下一批。
 *
 * 调用的现有命令：
 *   npx tsx scripts/import-part-numbers.ts --dry-run --resume --limit=N
 *   npx tsx scripts/import-part-numbers.ts --apply  --resume --limit=N
 *   npx tsx scripts/verify-stage33-generic.ts
 * ============================================================
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const RUN_LOG_DIR = path.join(LOG_DIR, "stage33-runs");
const LOCK_PATH = path.join(LOG_DIR, "stage33-safe-batch.lock");
const PENDING_PREVIEW_CSV = path.join(LOG_DIR, "stage33-pending-preview.csv");
const RESULT_MANIFEST_CSV = path.join(LOG_DIR, "stage33-import-result.csv");

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

// ===== CLI =====
const argv = process.argv.slice(2);
const limitArg = argv.find((a) => a.startsWith("--limit="));
const requestedLimit = limitArg ? parseInt(limitArg.split("=")[1], 10) : DEFAULT_LIMIT;

// ===== 工具函数 =====
function ts(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
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
  if (!fs.existsSync(file)) return [];
  const parsed = parseCsv(fs.readFileSync(file, "utf8"));
  if (parsed.length === 0) return [];
  const headers = parsed[0].map((h) => h.trim());
  return parsed.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
    return obj;
  });
}
function extractValue(stdout: string, key: string): string {
  // 匹配 "KEY = value" 或 "KEY=value"，value 到行尾
  const re = new RegExp(`^${key}\\s*=\\s*(.+)$`, "m");
  const m = stdout.match(re);
  return m ? m[1].trim() : "";
}
function fingerprint(partNumbers: string[]): string {
  const ordered = [...partNumbers].sort();
  const hash = crypto.createHash("sha256");
  hash.update(ordered.join("\n"));
  return hash.digest("hex");
}
function runCommand(cmd: string): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 10 * 1024 * 1024 });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (e: any) {
    return {
      exitCode: e.status ?? 1,
      stdout: e.stdout ? e.stdout.toString() : "",
      stderr: e.stderr ? e.stderr.toString() : (e.message || ""),
    };
  }
}

// ===== Run log =====
const runLog: Record<string, any> = {
  startedAt: new Date().toISOString(),
  requestedLimit,
};
function writeRunLog(finalStatus: string) {
  runLog.finishedAt = new Date().toISOString();
  runLog.finalStatus = finalStatus;
  try {
    fs.mkdirSync(RUN_LOG_DIR, { recursive: true });
    const logFile = path.join(RUN_LOG_DIR, `stage33-run-${ts()}-${process.pid}.json`);
    fs.writeFileSync(logFile, JSON.stringify(runLog, null, 2), "utf8");
    console.log(`RUN_LOG = ${path.basename(logFile)}`);
  } catch (e: any) {
    console.error(`[WARN] Cannot write run log: ${(e && e.message || "").split("\n")[0]}`);
  }
}

// ===== 主流程 =====
async function main() {
  console.log(`\n=== Stage 3.3C2 Safe Batch Runner ===\n`);
  console.log(`REQUESTED_BATCH_LIMIT = ${requestedLimit}`);

  // STEP 0: Limit validation
  if (isNaN(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_LIMIT) {
    console.log(`LIMIT_VALIDATION = FAIL (must be 1..${MAX_LIMIT}, got ${requestedLimit})`);
    console.log(`SAFE_BATCH_STATUS = BLOCKED`);
    writeRunLog("BLOCKED_LIMIT_INVALID");
    process.exit(1);
  }
  console.log(`LIMIT_VALIDATION = PASS`);
  runLog.limitValidation = "PASS";

  // STEP 0b: Single-run lock (atomic create)
  fs.mkdirSync(LOG_DIR, { recursive: true });
  let lockFd: number = -1;
  try {
    lockFd = fs.openSync(LOCK_PATH, "wx");
    fs.writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), limit: requestedLimit }, null, 2), "utf8");
    console.log(`BATCH_LOCK_ACQUIRED = PASS (pid=${process.pid})`);
  } catch (e: any) {
    console.log(`BATCH_LOCK_ACQUIRED = FAIL`);
    if (fs.existsSync(LOCK_PATH)) {
      try {
        const lockContent = fs.readFileSync(LOCK_PATH, "utf8");
        console.log(`LOCK_CONTENT = ${lockContent}`);
      } catch { /* ignore */ }
    }
    console.log(`STALE_LOCK_AUTO_DELETE = FORBIDDEN (manual review required)`);
    console.log(`SAFE_BATCH_STATUS = BLOCKED`);
    writeRunLog("BLOCKED_LOCK_EXISTS");
    process.exit(1);
  }
  runLog.lockAcquired = true;

  try {
    // ===== STEP 1: Resume Dry-run =====
    console.log(`\n[STEP 1/3] Resume Dry-run (limit=${requestedLimit})`);
    const dryCmd = `npx tsx scripts/import-part-numbers.ts --dry-run --resume --limit=${requestedLimit}`;
    const dryResult = runCommand(dryCmd);
    console.log(`DRY_RUN_EXIT_CODE = ${dryResult.exitCode}`);
    runLog.dryRunExitCode = dryResult.exitCode;

    if (dryResult.exitCode !== 0) {
      console.log(`DRY_RUN_GATE = FAIL (exit code != 0)`);
      console.log(`APPLY_NOT_STARTED = YES`);
      console.log(`SAFE_BATCH_STATUS = BLOCKED`);
      writeRunLog("BLOCKED_DRY_RUN_EXIT_NONZERO");
      process.exit(1);
    }

    // Parse required gates from stdout
    const dryGates: Record<string, string> = {};
    const DRY_REQUIRED = [
      "RESUME_PREFLIGHT_STATUS", "RESUME_SELECTION_ASSERTION", "SELECTED_COUNT_ASSERTION",
      "PREFLIGHT_STATUS", "DATABASE_WRITES",
      "EXISTING_CONFLICT", "RESUME_QUERY_ERROR_COUNT",
      "SELECTED_ALREADY_IMPORTED_INTERSECTION", "SELECTED_ALIAS_INTERSECTION",
      "EXACT_COLLISION_COUNT", "NORMALIZED_COLLISION_COUNT", "SLUG_COLLISION_COUNT",
      "BATCH_SLUG_DUPLICATE_COUNT", "COLLISION_QUERY_ERROR_COUNT",
      "PENDING_IMPORT", "REQUESTED_LIMIT", "EXPECTED_SELECTED_COUNT", "ACTUAL_SELECTED_COUNT",
    ];
    for (const key of DRY_REQUIRED) {
      dryGates[key] = extractValue(dryResult.stdout, key);
    }

    // Validate required PASS gates
    const PASS_GATES = ["RESUME_PREFLIGHT_STATUS", "RESUME_SELECTION_ASSERTION", "SELECTED_COUNT_ASSERTION", "PREFLIGHT_STATUS"];
    let dryGatePass = true;
    for (const key of PASS_GATES) {
      if (dryGates[key] !== "PASS") {
        console.log(`  [DRY_GATE_FAIL] ${key} = "${dryGates[key]}" (expected PASS)`);
        dryGatePass = false;
      }
    }
    // Validate zero-count gates
    const ZERO_GATES = ["EXISTING_CONFLICT", "RESUME_QUERY_ERROR_COUNT", "EXACT_COLLISION_COUNT", "NORMALIZED_COLLISION_COUNT", "SLUG_COLLISION_COUNT", "BATCH_SLUG_DUPLICATE_COUNT", "COLLISION_QUERY_ERROR_COUNT"];
    for (const key of ZERO_GATES) {
      if (dryGates[key] !== "0") {
        console.log(`  [DRY_GATE_FAIL] ${key} = "${dryGates[key]}" (expected 0)`);
        dryGatePass = false;
      }
    }
    // Validate intersection = 0
    if (dryGates["SELECTED_ALREADY_IMPORTED_INTERSECTION"] !== "0") {
      console.log(`  [DRY_GATE_FAIL] SELECTED_ALREADY_IMPORTED_INTERSECTION = "${dryGates["SELECTED_ALREADY_IMPORTED_INTERSECTION"]}"`);
      dryGatePass = false;
    }
    if (dryGates["SELECTED_ALIAS_INTERSECTION"] !== "0") {
      console.log(`  [DRY_GATE_FAIL] SELECTED_ALIAS_INTERSECTION = "${dryGates["SELECTED_ALIAS_INTERSECTION"]}"`);
      dryGatePass = false;
    }
    // DATABASE_WRITES must be 0 in dry-run
    if (dryGates["DATABASE_WRITES"] !== "0" && !dryGates["DATABASE_WRITES"].startsWith("0")) {
      console.log(`  [DRY_GATE_FAIL] DATABASE_WRITES = "${dryGates["DATABASE_WRITES"]}" (expected 0)`);
      dryGatePass = false;
    }

    const actualSelected = parseInt(dryGates["ACTUAL_SELECTED_COUNT"] || "0", 10);
    const expectedSelected = parseInt(dryGates["EXPECTED_SELECTED_COUNT"] || "0", 10);
    const pendingImport = parseInt(dryGates["PENDING_IMPORT"] || "0", 10);

    console.log(`PENDING_IMPORT = ${pendingImport}`);
    console.log(`DRY_RUN_SELECTED_COUNT = ${actualSelected}`);

    // NO_PENDING_BATCH check
    if (actualSelected === 0) {
      console.log(`NO_PENDING_BATCH = YES`);
      console.log(`APPLY_SKIPPED = YES`);
      console.log(`SAFE_BATCH_STATUS = NOTHING_TO_IMPORT`);
      runLog.dryRunSelectedCount = 0;
      runLog.noPendingBatch = true;
      writeRunLog("NOTHING_TO_IMPORT");
      return;
    }

    if (!dryGatePass) {
      console.log(`DRY_RUN_GATE = FAIL`);
      console.log(`APPLY_NOT_STARTED = YES`);
      console.log(`SAFE_BATCH_STATUS = BLOCKED`);
      runLog.dryRunGate = "FAIL";
      writeRunLog("BLOCKED_DRY_RUN_GATE_FAIL");
      process.exit(1);
    }
    console.log(`DRY_RUN_GATE = PASS`);
    runLog.dryRunGate = "PASS";
    runLog.dryRunSelectedCount = actualSelected;
    runLog.dryRunExpectedSelectedCount = expectedSelected;
    runLog.pendingImport = pendingImport;

    // Read selected partNumbers from pending preview CSV
    const pendingRows = loadCsv(PENDING_PREVIEW_CSV);
    if (pendingRows.length === 0) {
      console.log(`DRY_RUN_GATE = FAIL (stage33-pending-preview.csv missing or empty)`);
      console.log(`APPLY_NOT_STARTED = YES`);
      console.log(`SAFE_BATCH_STATUS = BLOCKED`);
      writeRunLog("BLOCKED_PENDING_PREVIEW_MISSING");
      process.exit(1);
    }
    const dryRunPartNumbers = pendingRows.map((r) => r.partNumber || "").filter(Boolean);
    if (dryRunPartNumbers.length !== actualSelected) {
      console.log(`DRY_RUN_GATE = FAIL (preview CSV rows=${dryRunPartNumbers.length} != ACTUAL_SELECTED_COUNT=${actualSelected})`);
      console.log(`APPLY_NOT_STARTED = YES`);
      console.log(`SAFE_BATCH_STATUS = BLOCKED`);
      writeRunLog("BLOCKED_PREVIEW_COUNT_MISMATCH");
      process.exit(1);
    }
    const dryRunFingerprint = fingerprint(dryRunPartNumbers);
    console.log(`DRY_RUN_FIRST_PART_NUMBER = ${dryRunPartNumbers[0]}`);
    console.log(`DRY_RUN_LAST_PART_NUMBER = ${dryRunPartNumbers[dryRunPartNumbers.length - 1]}`);
    console.log(`DRY_RUN_BATCH_FINGERPRINT = ${dryRunFingerprint}`);
    runLog.dryRunFirstPartNumber = dryRunPartNumbers[0];
    runLog.dryRunLastPartNumber = dryRunPartNumbers[dryRunPartNumbers.length - 1];
    runLog.dryRunFingerprint = dryRunFingerprint;

    // ===== STEP 2: Resume Apply =====
    console.log(`\n[STEP 2/3] Resume Apply (limit=${requestedLimit})`);
    runLog.applyStarted = new Date().toISOString();
    const applyCmd = `npx tsx scripts/import-part-numbers.ts --apply --resume --limit=${requestedLimit}`;
    const applyResult = runCommand(applyCmd);
    console.log(`APPLY_EXIT_CODE = ${applyResult.exitCode}`);
    runLog.applyExitCode = applyResult.exitCode;

    const transactionStatus = extractValue(applyResult.stdout, "TRANSACTION_STATUS");
    const applySelected = parseInt(extractValue(applyResult.stdout, "APPLY_SELECTED") || "0", 10);
    const createdPartNumbers = parseInt(extractValue(applyResult.stdout, "CREATED_PART_NUMBERS") || "0", 10);
    const createdEquipmentRelations = parseInt(extractValue(applyResult.stdout, "CREATED_EQUIPMENT_RELATIONS") || "0", 10);
    const createdAuditLogs = parseInt(extractValue(applyResult.stdout, "CREATED_AUDIT_LOGS") || "0", 10);
    const databaseWrites = extractValue(applyResult.stdout, "DATABASE_WRITES");
    const resultLog = extractValue(applyResult.stdout, "RESULT_LOG");

    console.log(`APPLY_SELECTED = ${applySelected}`);
    console.log(`CREATED_PART_NUMBERS = ${createdPartNumbers}`);
    console.log(`CREATED_EQUIPMENT_RELATIONS = ${createdEquipmentRelations}`);
    console.log(`CREATED_AUDIT_LOGS = ${createdAuditLogs}`);
    console.log(`TRANSACTION_STATUS = ${transactionStatus || "(not found in stdout)"}`);

    runLog.applySelected = applySelected;
    runLog.createdPartNumbers = createdPartNumbers;
    runLog.createdEquipmentRelations = createdEquipmentRelations;
    runLog.createdAuditLogs = createdAuditLogs;
    runLog.transactionStatus = transactionStatus;

    // Apply gate: exit code + TRANSACTION_STATUS=COMMITTED + count consistency
    let applyGatePass = true;
    if (applyResult.exitCode !== 0) {
      console.log(`  [APPLY_GATE_FAIL] exit code != 0`);
      applyGatePass = false;
    }
    if (transactionStatus !== "COMMITTED") {
      console.log(`  [APPLY_GATE_FAIL] TRANSACTION_STATUS = "${transactionStatus}" (expected COMMITTED)`);
      applyGatePass = false;
    }
    if (applySelected <= 0) {
      console.log(`  [APPLY_GATE_FAIL] APPLY_SELECTED = ${applySelected} (must be > 0)`);
      applyGatePass = false;
    }
    if (createdPartNumbers !== applySelected) {
      console.log(`  [APPLY_GATE_FAIL] CREATED_PART_NUMBERS=${createdPartNumbers} != APPLY_SELECTED=${applySelected}`);
      applyGatePass = false;
    }
    if (createdAuditLogs !== applySelected) {
      console.log(`  [APPLY_GATE_FAIL] CREATED_AUDIT_LOGS=${createdAuditLogs} != APPLY_SELECTED=${applySelected}`);
      applyGatePass = false;
    }
    if (createdEquipmentRelations < applySelected) {
      console.log(`  [APPLY_GATE_FAIL] CREATED_EQUIPMENT_RELATIONS=${createdEquipmentRelations} < APPLY_SELECTED=${applySelected}`);
      applyGatePass = false;
    }

    // If apply failed or commit uncertain: NEVER retry, manual review
    if (!applyGatePass) {
      console.log(`APPLY_GATE = FAIL`);
      if (transactionStatus === "COMMITTED") {
        console.log(`APPLY_COMMIT_STATE = COMMITTED_OR_UNCERTAIN`);
        console.log(`AUTO_RETRY = FORBIDDEN`);
        console.log(`MANUAL_REVIEW_REQUIRED = YES`);
        console.log(`SAFE_BATCH_STATUS = UNKNOWN_AFTER_APPLY`);
        runLog.applyGate = "FAIL_COMMITTED_UNCERTAIN";
        writeRunLog("UNKNOWN_AFTER_APPLY_MANUAL_REVIEW");
        process.exit(1);
      } else {
        console.log(`APPLY_COMMIT_STATE = ROLLED_BACK_OR_FAILED`);
        console.log(`SAFE_BATCH_STATUS = FAILED_ROLLED_BACK`);
        runLog.applyGate = "FAIL_ROLLED_BACK";
        writeRunLog("FAILED_ROLLED_BACK");
        process.exit(1);
      }
    }
    console.log(`APPLY_GATE = PASS`);
    runLog.applyGate = "PASS";

    // Result manifest gate
    console.log(`RESULT_LOG = ${resultLog}`);
    const manifestFound = fs.existsSync(RESULT_MANIFEST_CSV);
    console.log(`RESULT_MANIFEST_FOUND = ${manifestFound ? "PASS" : "FAIL"}`);
    if (!manifestFound) {
      console.log(`RESULT_MANIFEST_GATE = FAIL`);
      console.log(`APPLY_COMMIT_STATE = COMMITTED_OR_UNCERTAIN`);
      console.log(`AUTO_RETRY = FORBIDDEN`);
      console.log(`MANUAL_REVIEW_REQUIRED = YES`);
      console.log(`SAFE_BATCH_STATUS = UNKNOWN_AFTER_APPLY`);
      writeRunLog("UNKNOWN_AFTER_APPLY_MANIFEST_MISSING");
      process.exit(1);
    }
    const manifestRows = loadCsv(RESULT_MANIFEST_CSV);
    console.log(`MANIFEST_ROW_COUNT = ${manifestRows.length}`);
    if (manifestRows.length !== applySelected) {
      console.log(`RESULT_MANIFEST_GATE = FAIL (rows=${manifestRows.length} != APPLY_SELECTED=${applySelected})`);
      console.log(`AUTO_RETRY = FORBIDDEN`);
      console.log(`MANUAL_REVIEW_REQUIRED = YES`);
      console.log(`SAFE_BATCH_STATUS = UNKNOWN_AFTER_APPLY`);
      writeRunLog("UNKNOWN_AFTER_APPLY_MANIFEST_COUNT_MISMATCH");
      process.exit(1);
    }
    console.log(`RESULT_MANIFEST_GATE = PASS`);
    runLog.manifestFound = true;
    runLog.manifestRowCount = manifestRows.length;

    // Apply fingerprint from manifest
    const applyPartNumbers = manifestRows.map((r) => r.partNumber || "").filter(Boolean);
    const applyFingerprint = fingerprint(applyPartNumbers);
    console.log(`APPLY_BATCH_FINGERPRINT = ${applyFingerprint}`);
    runLog.applyFingerprint = applyFingerprint;

    const fingerprintMatch = applyFingerprint === dryRunFingerprint;
    console.log(`BATCH_FINGERPRINT_MATCH = ${fingerprintMatch ? "PASS" : "FAIL"}`);
    runLog.fingerprintMatch = fingerprintMatch ? "PASS" : "FAIL";
    if (!fingerprintMatch) {
      console.log(`AUTO_RETRY = FORBIDDEN`);
      console.log(`MANUAL_REVIEW_REQUIRED = YES`);
      console.log(`SAFE_BATCH_STATUS = UNKNOWN_AFTER_APPLY`);
      writeRunLog("UNKNOWN_AFTER_APPLY_FINGERPRINT_MISMATCH");
      process.exit(1);
    }

    // ===== STEP 3: Generic Verify =====
    console.log(`\n[STEP 3/3] Generic Batch Verify`);
    const verifyCmd = `npx tsx scripts/verify-stage33-generic.ts`;
    const verifyResult = runCommand(verifyCmd);
    console.log(`VERIFY_EXIT_CODE = ${verifyResult.exitCode}`);
    runLog.verifyExitCode = verifyResult.exitCode;

    const VERIFY_REQUIRED = [
      "MANIFEST_FILE_FOUND", "MANIFEST_VALIDATION", "GENERIC_BATCH_VERIFY",
      "TARGET_BATCH_EXPECTED", "TARGET_BATCH_FOUND", "TARGET_BATCH_MISSING", "QUERY_ERROR_COUNT",
      "TARGET_IDENTITY_VALID", "TARGET_STATUS_VALID", "TARGET_CATEGORY_VALID",
      "TARGET_EVIDENCE_VALID", "TARGET_EQUIPMENT_RELATIONS_VALID", "TARGET_AUDIT_VALID",
      "DATABASE_WRITES",
    ];
    const verifyGates: Record<string, string> = {};
    for (const key of VERIFY_REQUIRED) {
      verifyGates[key] = extractValue(verifyResult.stdout, key);
    }

    let verifyGatePass = true;
    if (verifyResult.exitCode !== 0) {
      console.log(`  [VERIFY_GATE_FAIL] exit code != 0`);
      verifyGatePass = false;
    }
    const VERIFY_PASS = ["MANIFEST_FILE_FOUND", "MANIFEST_VALIDATION", "GENERIC_BATCH_VERIFY",
      "TARGET_IDENTITY_VALID", "TARGET_STATUS_VALID", "TARGET_CATEGORY_VALID",
      "TARGET_EVIDENCE_VALID", "TARGET_EQUIPMENT_RELATIONS_VALID", "TARGET_AUDIT_VALID"];
    for (const key of VERIFY_PASS) {
      if (verifyGates[key] !== "PASS") {
        console.log(`  [VERIFY_GATE_FAIL] ${key} = "${verifyGates[key]}" (expected PASS)`);
        verifyGatePass = false;
      }
    }
    const verifyBatchExpected = parseInt(verifyGates["TARGET_BATCH_EXPECTED"] || "0", 10);
    const verifyBatchFound = parseInt(verifyGates["TARGET_BATCH_FOUND"] || "0", 10);
    const verifyBatchMissing = parseInt(verifyGates["TARGET_BATCH_MISSING"] || "0", 10);
    const verifyQueryError = parseInt(verifyGates["QUERY_ERROR_COUNT"] || "0", 10);
    if (verifyBatchExpected !== applySelected) {
      console.log(`  [VERIFY_GATE_FAIL] TARGET_BATCH_EXPECTED=${verifyBatchExpected} != APPLY_SELECTED=${applySelected}`);
      verifyGatePass = false;
    }
    if (verifyBatchFound !== applySelected) {
      console.log(`  [VERIFY_GATE_FAIL] TARGET_BATCH_FOUND=${verifyBatchFound} != APPLY_SELECTED=${applySelected}`);
      verifyGatePass = false;
    }
    if (verifyBatchMissing !== 0) {
      console.log(`  [VERIFY_GATE_FAIL] TARGET_BATCH_MISSING=${verifyBatchMissing} (expected 0)`);
      verifyGatePass = false;
    }
    if (verifyQueryError !== 0) {
      console.log(`  [VERIFY_GATE_FAIL] QUERY_ERROR_COUNT=${verifyQueryError} (expected 0)`);
      verifyGatePass = false;
    }

    console.log(`TARGET_BATCH_EXPECTED = ${verifyBatchExpected}`);
    console.log(`TARGET_BATCH_FOUND = ${verifyBatchFound}`);
    console.log(`TARGET_BATCH_MISSING = ${verifyBatchMissing}`);
    console.log(`GENERIC_BATCH_VERIFY = ${verifyGates["GENERIC_BATCH_VERIFY"]}`);

    if (!verifyGatePass) {
      console.log(`VERIFY_GATE = FAIL`);
      console.log(`APPLY_COMMIT_STATE = COMMITTED`);
      console.log(`AUTO_RETRY = FORBIDDEN`);
      console.log(`MANUAL_REVIEW_REQUIRED = YES`);
      console.log(`SAFE_BATCH_STATUS = COMMITTED_VERIFY_FAILED`);
      runLog.verifyGate = "FAIL";
      writeRunLog("COMMITTED_VERIFY_FAILED");
      process.exit(1);
    }
    console.log(`VERIFY_GATE = PASS`);
    runLog.verifyGate = "PASS";
    runLog.genericVerifyStatus = "PASS";

    // ===== Final result =====
    console.log(`\n=== SAFE BATCH RESULT ===`);
    console.log(`SAFE_BATCH_STATUS = PASS`);
    console.log(`IMPORTED_THIS_BATCH = ${applySelected}`);
    console.log(`AUTO_NEXT_BATCH = NO`);
    console.log(`DATABASE_WRITE_SOURCE = EXISTING_IMPORTER_ONLY`);
    writeRunLog("PASS");

  } finally {
    // Release lock
    if (lockFd >= 0) {
      try {
        fs.closeSync(lockFd);
      } catch { /* ignore */ }
    }
    try {
      if (fs.existsSync(LOCK_PATH)) {
        fs.unlinkSync(LOCK_PATH);
      }
      console.log(`BATCH_LOCK_RELEASED = PASS`);
    } catch (e: any) {
      console.error(`[WARN] Cannot release lock: ${(e && e.message || "").split("\n")[0]}`);
    }
  }
}

main().catch((e) => {
  console.error(`[FATAL] Safe Batch Runner exception: ${e && e.message || e}`);
  writeRunLog("FATAL_EXCEPTION");
  process.exit(1);
});
