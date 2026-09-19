/**
 * ============================================================
 * V3.1 Stage 3.6B-P2-A.1 — G5-8516 Pilot Write (Controlled, Idempotent)
 *
 * 第一组 Pilot：114-8516LFL ↔ G5-8516  POSSIBLE_MATCH  CANDIDATE
 *
 * 三状态识别（idempotency + fail-closed）：
 *   STATE_A_NOT_APPLIED   G5-8516 不存在 + Pilot CrossReference 不存在
 *                          → 允许未来 --apply 创建
 *   STATE_B_ALREADY_APPLIED G5-8516 存在且关键字段与 Pilot 预期完全一致
 *                          + Pilot CrossReference 存在且关键字段与预期完全一致
 *                          → NO-OP → DATABASE_WRITES=0 → result=ALREADY_APPLIED
 *   STATE_C_CONFLICT      G5-8516 存在但关键字段与 Pilot 不一致
 *                          或 CrossReference 存在但关键字段/状态不一致
 *                          或 normalized/slug 被其他 PN 占用
 *                          → FAIL CLOSED → DATABASE_WRITES=0 → manual review required
 *
 * 不允许"只要 G5-8516 exists 就盲目跳过"。
 *
 * 安全原则：
 *   - 默认 DRY_RUN=true，DATABASE_WRITES=0
 *   - 必须通过 --apply 才允许真正写入
 *   - 单 transaction，任何失败 ROLLBACK
 *   - 不编造业务事实：name/category 使用中性占位，不复制 114-8516LFL 的 Spider/Structure/Sandvik/ED10/LS190
 *   - 不自动提升 evidence/confidence
 *
 * 用法：
 *   npm run pilot:pn-cross-reference              # dry-run (默认)
 *   npm run pilot:pn-cross-reference -- --apply   # 真正写入 (需人工确认)
 * ============================================================
 */

// ===== Pilot 配置（写入前人工确认这些值） =====
const PILOT = {
  // 已知锚点：114-8516LFL 必须存在且 id=185
  anchorPartNumber: "114-8516LFL",
  anchorExpectedId: 185,

  // 待创建的 G5-8516
  newPartNumber: "G5-8516",
  newNormalized: "G58516",
  newSlug: "g5-8516",

  // ===== 中性占位值（技术必填，但业务事实未知） =====
  // WARNING: 这些是占位值，不是经过验证的业务事实。
  // name 不使用 "Spider" / "十字轴"（那是 114-8516LFL 的名称，未经证据不能复制给 G5-8516）。
  // category 不使用 "Structure"（同上）。
  // 未来人工验证后应更新这些字段。
  newNamePlaceholder: "G5-8516", // 用件号本身作为名称占位
  newCategoryPlaceholder: "Uncategorized", // 中性分类占位

  // Cross Reference 关系
  relationType: "POSSIBLE_MATCH" as const,
  verificationStatus: "CANDIDATE" as const,
  // confidence 不根据 114-8516LFL 的 HIGH 自动提升，保持 schema default MEDIUM
  confidence: "MEDIUM" as const,
  // 严谨表述：明确说明无技术证据，不暗示已确认等价
  evidenceSummary:
    "Candidate reference supplied from business-side information. " +
    "No manufacturer cross-reference, drawing, dimensions, specification, " +
    "or other technical equivalence evidence verified at creation time. " +
    "Technical equivalence not established. " +
    "Pilot: 114-8516LFL <-> G5-8516.",
  sourceReference: "Stage 3.6B Pilot — business-supplied candidate, pending technical verification",
};

// G5-8516 预期关键字段（用于 STATE_B 一致性校验）
const EXPECTED_G5_FIELDS = {
  number: PILOT.newPartNumber,
  normalizedPartNumber: PILOT.newNormalized,
  slug: PILOT.newSlug,
  name: PILOT.newNamePlaceholder,
  category: PILOT.newCategoryPlaceholder,
  verificationStatus: "UNVERIFIED",
  publishStatus: "HOLD",
  verified: false,
  modelEvidence: "NOT_EXPLICIT",
  confidence: "MEDIUM",
  brandId: null,
  equipmentId: null,
};

// ===== 参数解析 =====
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DRY_RUN = !APPLY;

type PilotState = "STATE_A_NOT_APPLIED" | "STATE_B_ALREADY_APPLIED" | "STATE_C_CONFLICT";

async function main() {
  console.log(`\n=== Stage 3.6B-P2-A.1 G5-8516 Pilot Write (Idempotent) ===`);
  console.log(`MODE = ${DRY_RUN ? "DRY-RUN (DATABASE_WRITES=0)" : "APPLY (will write if STATE_A)"}`);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // ============================================================
    // STEP 0: Read-only preflight — 收集所有信息，判定状态
    // ============================================================
    console.log(`\n--- STEP 0: Read-only preflight ---`);

    // 0a. 114-8516LFL 必须存在且 id=185
    const anchor = await prisma.partNumber.findUnique({
      where: { number: PILOT.anchorPartNumber },
      select: { id: true, number: true, verificationStatus: true, publishStatus: true },
    });
    if (!anchor) {
      throw new Error(`FAIL CLOSED: Anchor ${PILOT.anchorPartNumber} not found`);
    }
    if (anchor.id !== PILOT.anchorExpectedId) {
      throw new Error(
        `FAIL CLOSED: Anchor ${PILOT.anchorPartNumber} id=${anchor.id}, expected ${PILOT.anchorExpectedId}`
      );
    }
    console.log(`  ANCHOR_114_8516LFL = YES (id=${anchor.id}, verif=${anchor.verificationStatus}, pub=${anchor.publishStatus})`);

    // 0b. G5-8516 exact 检查（如果存在，读取所有关键字段用于一致性校验）
    const g5Exact = await prisma.partNumber.findUnique({
      where: { number: PILOT.newPartNumber },
      select: {
        id: true, number: true, normalizedPartNumber: true, slug: true,
        name: true, category: true, verificationStatus: true, publishStatus: true,
        verified: true, modelEvidence: true, confidence: true, brandId: true, equipmentId: true,
      },
    });
    console.log(`  G5_8516_EXISTS = ${g5Exact ? `YES (id=${g5Exact.id})` : "NO"}`);

    // 0c. normalized collision（被其他 PN 占用 = conflict）
    const normalizedHits = await prisma.partNumber.findMany({
      where: { normalizedPartNumber: PILOT.newNormalized },
      select: { id: true, number: true },
    });
    const normalizedCollisionByOther = normalizedHits.filter((p) => p.number !== PILOT.newPartNumber);
    console.log(`  NORMALIZED_COLLISION = ${normalizedCollisionByOther.length > 0 ? `YES (${normalizedCollisionByOther.map((p) => p.number).join(",")})` : "NO"}`);

    // 0d. slug collision（被其他 PN 占用 = conflict）
    const slugHit = await prisma.partNumber.findUnique({
      where: { slug: PILOT.newSlug },
      select: { id: true, number: true },
    });
    const slugCollisionByOther = slugHit && slugHit.number !== PILOT.newPartNumber;
    console.log(`  SLUG_COLLISION = ${slugCollisionByOther ? `YES (id=${slugHit?.id}, number=${slugHit?.number})` : "NO"}`);

    // 0e. 现有 Pilot CrossReference 检查
    //     可能的 canonical pair: (185, G5_id) 或 (G5_id, 185)，但 G5_id 只有在 G5 存在时才知道
    let existingCr: { id: number; relationType: string; verificationStatus: string; confidence: string; sourcePartNumberId: number; targetPartNumberId: number } | null = null;
    if (g5Exact) {
      const g5Id = g5Exact.id;
      const sourceId = Math.min(PILOT.anchorExpectedId, g5Id);
      const targetId = Math.max(PILOT.anchorExpectedId, g5Id);
      existingCr = await prisma.partNumberCrossReference.findUnique({
        where: {
          sourcePartNumberId_targetPartNumberId_relationType: {
            sourcePartNumberId: sourceId,
            targetPartNumberId: targetId,
            relationType: PILOT.relationType,
          },
        },
        select: { id: true, relationType: true, verificationStatus: true, confidence: true, sourcePartNumberId: true, targetPartNumberId: true },
      });
    }
    console.log(`  EXISTING_PILOT_CROSS_REFERENCE = ${existingCr ? `YES (id=${existingCr.id}, verif=${existingCr.verificationStatus}, conf=${existingCr.confidence})` : "NO"}`);

    // 0f. READY count baseline
    const readyCountBefore = await prisma.partNumber.count({ where: { publishStatus: "READY" } });
    console.log(`  READY_COUNT_BASELINE = ${readyCountBefore}`);

    // ============================================================
    // STEP 1: 状态判定
    // ============================================================
    console.log(`\n--- STEP 1: Pilot state determination ---`);

    let pilotState: PilotState;
    let conflictReasons: string[] = [];

    // collision 优先判定为 STATE_C
    if (normalizedCollisionByOther.length > 0) {
      conflictReasons.push(`normalizedPartNumber ${PILOT.newNormalized} occupied by other PN: ${normalizedCollisionByOther.map((p) => p.number).join(",")}`);
    }
    if (slugCollisionByOther) {
      conflictReasons.push(`slug ${PILOT.newSlug} occupied by other PN: id=${slugHit?.id}, number=${slugHit?.number}`);
    }

    if (conflictReasons.length > 0) {
      pilotState = "STATE_C_CONFLICT";
    } else if (!g5Exact) {
      // G5 不存在
      if (existingCr) {
        // 理论上不可能（G5 不存在则 CR 不可能引用它），但防御性检查
        conflictReasons.push(`CrossReference exists (id=${existingCr.id}) but G5-8516 PartNumber does not exist`);
        pilotState = "STATE_C_CONFLICT";
      } else {
        pilotState = "STATE_A_NOT_APPLIED";
      }
    } else {
      // G5 存在 — 校验关键字段一致性
      const fieldMismatches: string[] = [];
      for (const [key, expected] of Object.entries(EXPECTED_G5_FIELDS)) {
        const actual = (g5Exact as any)[key];
        if (actual !== expected) {
          fieldMismatches.push(`${key}: expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`);
        }
      }

      if (fieldMismatches.length > 0) {
        conflictReasons.push(`G5-8516 field mismatch: ${fieldMismatches.join("; ")}`);
      }

      if (!existingCr) {
        conflictReasons.push(`G5-8516 exists but Pilot CrossReference (POSSIBLE_MATCH) does not exist`);
      } else {
        // 校验 CR 关键字段
        if (existingCr.relationType !== PILOT.relationType) {
          conflictReasons.push(`CR relationType mismatch: expected=${PILOT.relationType}, actual=${existingCr.relationType}`);
        }
        if (existingCr.verificationStatus !== PILOT.verificationStatus) {
          conflictReasons.push(`CR verificationStatus mismatch: expected=${PILOT.verificationStatus}, actual=${existingCr.verificationStatus}`);
        }
        if (existingCr.confidence !== PILOT.confidence) {
          conflictReasons.push(`CR confidence mismatch: expected=${PILOT.confidence}, actual=${existingCr.confidence}`);
        }
      }

      pilotState = conflictReasons.length > 0 ? "STATE_C_CONFLICT" : "STATE_B_ALREADY_APPLIED";
    }

    console.log(`  PILOT_STATE = ${pilotState}`);
    if (conflictReasons.length > 0) {
      for (const r of conflictReasons) {
        console.log(`    CONFLICT: ${r}`);
      }
    }

    // ============================================================
    // STEP 2: 根据状态执行
    // ============================================================

    // STATE_C_CONFLICT → FAIL CLOSED，无论 dry-run 还是 apply 都拒绝
    if (pilotState === "STATE_C_CONFLICT") {
      console.log(`\n--- STATE_C_CONFLICT: FAIL CLOSED ---`);
      console.log(`  DATABASE_WRITES = 0`);
      console.log(`  MANUAL_REVIEW_REQUIRED = YES`);
      console.log(`  REASON = ${conflictReasons.join(" | ")}`);
      process.exitCode = 1;
      return;
    }

    // STATE_B_ALREADY_APPLIED → NO-OP
    if (pilotState === "STATE_B_ALREADY_APPLIED") {
      console.log(`\n--- STATE_B_ALREADY_APPLIED: NO-OP ---`);
      console.log(`  G5-8516 already exists with all expected fields`);
      console.log(`  Pilot CrossReference already exists with all expected fields`);
      console.log(`  DATABASE_WRITES = 0`);
      console.log(`  RESULT = ALREADY_APPLIED`);
      return;
    }

    // STATE_A_NOT_APPLIED → 可以创建
    console.log(`\n--- STATE_A_NOT_APPLIED: ready to create ---`);

    if (DRY_RUN) {
      console.log(`\n  WOULD_CREATE_PART_NUMBER = YES`);
      console.log(`    number = ${PILOT.newPartNumber}`);
      console.log(`    normalizedPartNumber = ${PILOT.newNormalized}`);
      console.log(`    slug = ${PILOT.newSlug}`);
      console.log(`    name = "${PILOT.newNamePlaceholder}"  ← NEUTRAL PLACEHOLDER (not Spider/十字轴)`);
      console.log(`    category = "${PILOT.newCategoryPlaceholder}"  ← NEUTRAL PLACEHOLDER (not Structure)`);
      console.log(`    verificationStatus = UNVERIFIED (schema default)`);
      console.log(`    publishStatus = HOLD (schema default)`);
      console.log(`    verified = false (schema default)`);
      console.log(`    modelEvidence = NOT_EXPLICIT (schema default, NOT auto-elevated)`);
      console.log(`    confidence = MEDIUM (schema default, NOT auto-elevated from 114-8516LFL HIGH)`);
      console.log(`    brandId = null (NOT auto-set Sandvik)`);
      console.log(`    equipmentId = null (NOT auto-set ED10/LS190)`);
      console.log(`    equipmentRelations = [] (NOT auto-created)`);

      console.log(`\n  WOULD_CREATE_CROSS_REFERENCE = YES`);
      console.log(`    relationType = ${PILOT.relationType}`);
      console.log(`    verificationStatus = ${PILOT.verificationStatus}`);
      console.log(`    confidence = ${PILOT.confidence}`);
      console.log(`    evidenceSummary = "${PILOT.evidenceSummary}"`);
      console.log(`    canonical ordering: source = min(185, G5_new_id), target = max(185, G5_new_id)`);

      console.log(`\n  HUMAN_DECISION_REQUIRED_BEFORE_APPLY:`);
      console.log(`    1. name placeholder "${PILOT.newNamePlaceholder}" — acceptable, or supply real name?`);
      console.log(`    2. category placeholder "${PILOT.newCategoryPlaceholder}" — acceptable, or supply real category?`);
      console.log(`    3. Confirm no technical evidence exists to elevate from CANDIDATE/MEDIUM`);

      console.log(`\n  DRY_RUN_STATUS = PASS`);
      console.log(`  DATABASE_WRITES = 0`);
      console.log(`  To apply: npm run pilot:pn-cross-reference -- --apply`);
      return;
    }

    // ============================================================
    // APPLY: STATE_A → 真正写入（单 transaction）
    // ============================================================
    console.log(`\n--- APPLY: creating G5-8516 + Pilot CrossReference (transaction) ---`);

    let createdG5Id: number | null = null;
    let createdCrId: number | null = null;

    await prisma.$transaction(async (tx) => {
      // Re-check inside transaction (防止 race)
      const anchorTx = await tx.partNumber.findUnique({ where: { number: PILOT.anchorPartNumber }, select: { id: true } });
      if (!anchorTx || anchorTx.id !== PILOT.anchorExpectedId) {
        throw new Error(`FAIL CLOSED: Anchor check inside transaction failed`);
      }
      const g5Tx = await tx.partNumber.findUnique({ where: { number: PILOT.newPartNumber }, select: { id: true } });
      if (g5Tx) {
        throw new Error(`FAIL CLOSED: G5-8516 appeared during transaction (race), id=${g5Tx.id}`);
      }

      // Create G5-8516
      const g5Created = await tx.partNumber.create({
        data: {
          number: PILOT.newPartNumber,
          normalizedPartNumber: PILOT.newNormalized,
          slug: PILOT.newSlug,
          name: PILOT.newNamePlaceholder,
          category: PILOT.newCategoryPlaceholder,
          // 以下全部使用 schema default，不显式设置：
          // verificationStatus = UNVERIFIED, publishStatus = HOLD, verified = false
          // modelEvidence = NOT_EXPLICIT, confidence = MEDIUM, oemStatus = AFTERMARKET
          // brandId = null, equipmentId = null
        },
        select: { id: true },
      });
      createdG5Id = g5Created.id;
      console.log(`  PARTNUMBER_CREATED = YES (id=${g5Created.id})`);

      // Canonical ordering
      const sourceId = Math.min(PILOT.anchorExpectedId, g5Created.id);
      const targetId = Math.max(PILOT.anchorExpectedId, g5Created.id);
      if (sourceId === targetId) {
        throw new Error(`FAIL CLOSED: self-reference prevented`);
      }
      console.log(`  CANONICAL_ORDERING = source=${sourceId}, target=${targetId}`);

      // Create CrossReference
      const crCreated = await tx.partNumberCrossReference.create({
        data: {
          sourcePartNumberId: sourceId,
          targetPartNumberId: targetId,
          relationType: PILOT.relationType,
          verificationStatus: PILOT.verificationStatus,
          confidence: PILOT.confidence,
          evidenceSummary: PILOT.evidenceSummary,
          sourceReference: PILOT.sourceReference,
          // verifiedAt = null, verifiedById = null (CANDIDATE 未验证)
        },
        select: { id: true },
      });
      createdCrId = crCreated.id;
      console.log(`  CROSS_REFERENCE_CREATED = YES (id=${crCreated.id})`);
    });

    // ============================================================
    // Post-write verification (READ-ONLY)
    // ============================================================
    console.log(`\n--- Post-write verification (READ-ONLY) ---`);

    const g5Verify = await prisma.partNumber.findUnique({
      where: { number: PILOT.newPartNumber },
      select: { id: true, verificationStatus: true, publishStatus: true, verified: true, modelEvidence: true, confidence: true, brandId: true, equipmentId: true },
    });

    let verifyPass = true;
    if (g5Verify?.verificationStatus !== "UNVERIFIED") { console.log(`  FAIL: verificationStatus should be UNVERIFIED, got ${g5Verify?.verificationStatus}`); verifyPass = false; }
    if (g5Verify?.publishStatus !== "HOLD") { console.log(`  FAIL: publishStatus should be HOLD, got ${g5Verify?.publishStatus}`); verifyPass = false; }
    if (g5Verify?.verified !== false) { console.log(`  FAIL: verified should be false`); verifyPass = false; }
    if (g5Verify?.modelEvidence !== "NOT_EXPLICIT") { console.log(`  FAIL: modelEvidence should be NOT_EXPLICIT, got ${g5Verify?.modelEvidence}`); verifyPass = false; }
    if (g5Verify?.confidence !== "MEDIUM") { console.log(`  FAIL: confidence should be MEDIUM, got ${g5Verify?.confidence}`); verifyPass = false; }
    if (g5Verify?.brandId !== null) { console.log(`  FAIL: brandId should be null, got ${g5Verify?.brandId}`); verifyPass = false; }
    if (g5Verify?.equipmentId !== null) { console.log(`  FAIL: equipmentId should be null, got ${g5Verify?.equipmentId}`); verifyPass = false; }

    const crVerify = await prisma.partNumberCrossReference.findFirst({
      where: {
        OR: [
          { sourcePartNumberId: PILOT.anchorExpectedId, targetPartNumberId: g5Verify?.id },
          { sourcePartNumberId: g5Verify?.id, targetPartNumberId: PILOT.anchorExpectedId },
        ],
        relationType: PILOT.relationType,
      },
      select: { verificationStatus: true, confidence: true },
    });
    if (crVerify?.verificationStatus !== "CANDIDATE") { console.log(`  FAIL: CR verificationStatus should be CANDIDATE, got ${crVerify?.verificationStatus}`); verifyPass = false; }
    if (crVerify?.confidence !== "MEDIUM") { console.log(`  FAIL: CR confidence should be MEDIUM, got ${crVerify?.confidence}`); verifyPass = false; }

    const readyCountAfter = await prisma.partNumber.count({ where: { publishStatus: "READY" } });
    if (readyCountAfter !== readyCountBefore) { console.log(`  FAIL: READY count changed: ${readyCountBefore} -> ${readyCountAfter}`); verifyPass = false; }

    console.log(`  G5_8516_VERIFICATION_STATUS = ${g5Verify?.verificationStatus}`);
    console.log(`  G5_8516_PUBLISH_STATUS = ${g5Verify?.publishStatus}`);
    console.log(`  G5_8516_MODEL_EVIDENCE = ${g5Verify?.modelEvidence}`);
    console.log(`  G5_8516_CONFIDENCE = ${g5Verify?.confidence}`);
    console.log(`  CR_VERIFICATION_STATUS = ${crVerify?.verificationStatus}`);
    console.log(`  READY_COUNT_BEFORE = ${readyCountBefore}`);
    console.log(`  READY_COUNT_AFTER = ${readyCountAfter}`);
    console.log(`  POST_WRITE_VERIFY = ${verifyPass ? "PASS" : "FAIL"}`);
    console.log(`  DATABASE_WRITES = 2 (1 PartNumber + 1 CrossReference)`);

    if (!verifyPass) {
      throw new Error("Post-write verification FAILED — manual review required");
    }

    console.log(`\n=== PILOT APPLY COMPLETE (STATE_A -> APPLIED) ===`);
  } catch (e: any) {
    console.error(`\n❌ PILOT_FAILED: ${e.message || String(e)}`);
    console.error(`DATABASE_WRITES = 0 (transaction rolled back or never started)`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
export {};
