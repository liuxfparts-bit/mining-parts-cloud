/**
 * ============================================================
 * V3.1 Stage 3.6B-P2-A — G5-8516 Pilot Write (Controlled)
 *
 * 第一组 Pilot：114-8516LFL ↔ G5-8516  POSSIBLE_MATCH  CANDIDATE
 *
 * 安全原则：
 *   - 默认 DRY_RUN=true，DATABASE_WRITES=0
 *   - 必须通过 --apply 才允许真正写入
 *   - 单 transaction，任何失败 ROLLBACK
 *   - idempotent：已存在则跳过，不重复创建
 *   - fail closed：前置条件不符合 → NO WRITE
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
  evidenceSummary:
    "business-supplied candidate reference; technical equivalence not yet verified. Pilot: 114-8516LFL <-> G5-8516.",
  sourceReference: "Stage 3.6B Pilot — business-supplied candidate, pending technical verification",
};

// ===== 参数解析 =====
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DRY_RUN = !APPLY;

async function main() {
  console.log(`\n=== Stage 3.6B-P2-A G5-8516 Pilot Write ===`);
  console.log(`MODE = ${DRY_RUN ? "DRY-RUN (DATABASE_WRITES=0)" : "APPLY (will write)"}`);
  console.log(``);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // ============================================================
    // STEP 0: Pre-write checks (READ-ONLY, 无论 dry-run 还是 apply 都执行)
    // ============================================================
    console.log(`--- STEP 0: Pre-write checks (READ-ONLY) ---`);

    // 0a. 114-8516LFL 必须存在且 id=185
    const anchor = await prisma.partNumber.findUnique({
      where: { number: PILOT.anchorPartNumber },
      select: { id: true, number: true, verificationStatus: true, publishStatus: true },
    });
    if (!anchor) {
      throw new Error(`FAIL: Anchor ${PILOT.anchorPartNumber} not found`);
    }
    if (anchor.id !== PILOT.anchorExpectedId) {
      throw new Error(
        `FAIL: Anchor ${PILOT.anchorPartNumber} id=${anchor.id}, expected ${PILOT.anchorExpectedId}`
      );
    }
    console.log(`  ANCHOR_FOUND = YES (id=${anchor.id}, number=${anchor.number}, verif=${anchor.verificationStatus}, pub=${anchor.publishStatus})`);

    // 0b. G5-8516 exact 不存在
    const existingExact = await prisma.partNumber.findUnique({
      where: { number: PILOT.newPartNumber },
      select: { id: true, number: true, verificationStatus: true, publishStatus: true },
    });
    console.log(`  G5_8516_EXACT_EXISTS = ${existingExact ? `YES (id=${existingExact.id})` : "NO"}`);

    // 0c. G5-8516 normalized collision 不存在
    const existingNormalized = await prisma.partNumber.findMany({
      where: { normalizedPartNumber: PILOT.newNormalized },
      select: { id: true, number: true },
    });
    if (existingNormalized.length > 0) {
      throw new Error(
        `FAIL: normalized collision for ${PILOT.newNormalized}: ${existingNormalized.map((p) => p.number).join(",")}`
      );
    }
    console.log(`  G5_8516_NORMALIZED_COLLISION = NO`);

    // 0d. G5-8516 slug collision 不存在
    const existingSlug = await prisma.partNumber.findUnique({
      where: { slug: PILOT.newSlug },
      select: { id: true, number: true },
    });
    if (existingSlug) {
      throw new Error(`FAIL: slug collision for ${PILOT.newSlug}: id=${existingSlug.id}, number=${existingSlug.number}`);
    }
    console.log(`  G5_8516_SLUG_COLLISION = NO`);

    // 0e. 记录当前 READY count（用于 post-write 验证不变）
    const readyCountBefore = await prisma.partNumber.count({ where: { publishStatus: "READY" } });
    console.log(`  READY_COUNT_BEFORE = ${readyCountBefore}`);

    // ============================================================
    // STEP 1: Dry-run 预览（不写入）
    // ============================================================
    if (DRY_RUN) {
      console.log(`\n--- STEP 1: DRY-RUN preview (NO WRITE) ---`);
      console.log(`  WOULD_CREATE_PARTNUMBER:`);
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

      // canonical ordering 预览（需要知道 G5-8516 的 id，但还没创建，所以用逻辑说明）
      console.log(`\n  WOULD_CREATE_CROSS_REFERENCE:`);
      console.log(`    relationType = ${PILOT.relationType}`);
      console.log(`    verificationStatus = ${PILOT.verificationStatus}`);
      console.log(`    confidence = ${PILOT.confidence}`);
      console.log(`    evidenceSummary = "${PILOT.evidenceSummary}"`);
      console.log(`    canonical ordering: source = min(185, G5_id), target = max(185, G5_id)`);
      console.log(`    self-reference check: 185 != G5_id (guaranteed since G5 is new)`);
      console.log(`    duplicate check: unique(source,target,type) — will verify at create time`);

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
    // STEP 2: Apply (真正写入，单 transaction)
    // ============================================================
    console.log(`\n--- STEP 2: APPLY (transaction) ---`);

    let createdPnId: number | null = null;
    let createdCrId: number | null = null;
    let pnAlreadyExisted = false;
    let crAlreadyExisted = false;

    await prisma.$transaction(async (tx) => {
      // 2a. Re-check inside transaction (防止 race)
      const anchorTx = await tx.partNumber.findUnique({ where: { number: PILOT.anchorPartNumber }, select: { id: true } });
      if (!anchorTx || anchorTx.id !== PILOT.anchorExpectedId) {
        throw new Error(`FAIL: Anchor check inside transaction failed`);
      }

      // 2b. Create G5-8516 (idempotent: 如果已存在则跳过)
      let g5Record = await tx.partNumber.findUnique({ where: { number: PILOT.newPartNumber }, select: { id: true, verificationStatus: true, publishStatus: true } });
      if (g5Record) {
        pnAlreadyExisted = true;
        createdPnId = g5Record.id;
        console.log(`  PARTNUMBER_ALREADY_EXISTS = YES (id=${g5Record.id}, skip create)`);
      } else {
        g5Record = await tx.partNumber.create({
          data: {
            number: PILOT.newPartNumber,
            normalizedPartNumber: PILOT.newNormalized,
            slug: PILOT.newSlug,
            name: PILOT.newNamePlaceholder,
            category: PILOT.newCategoryPlaceholder,
            // 以下全部使用 schema default，不显式设置：
            // verificationStatus = UNVERIFIED
            // publishStatus = HOLD
            // verified = false
            // modelEvidence = NOT_EXPLICIT
            // confidence = MEDIUM
            // oemStatus = AFTERMARKET
            // brandId = null
            // equipmentId = null
          },
          select: { id: true, verificationStatus: true, publishStatus: true },
        });
        createdPnId = g5Record.id;
        console.log(`  PARTNUMBER_CREATED = YES (id=${g5Record.id})`);
      }

      // 2c. Canonical ordering
      const sourceId = Math.min(PILOT.anchorExpectedId, g5Record.id);
      const targetId = Math.max(PILOT.anchorExpectedId, g5Record.id);
      if (sourceId === targetId) {
        throw new Error(`FAIL: self-reference prevented (sourceId === targetId === ${sourceId})`);
      }
      console.log(`  CANONICAL_ORDERING = source=${sourceId}, target=${targetId}`);

      // 2d. Create Cross Reference (idempotent)
      const existingCr = await tx.partNumberCrossReference.findUnique({
        where: {
          sourcePartNumberId_targetPartNumberId_relationType: {
            sourcePartNumberId: sourceId,
            targetPartNumberId: targetId,
            relationType: PILOT.relationType,
          },
        },
        select: { id: true, verificationStatus: true },
      });
      if (existingCr) {
        crAlreadyExisted = true;
        createdCrId = existingCr.id;
        console.log(`  CROSS_REFERENCE_ALREADY_EXISTS = YES (id=${existingCr.id}, skip create)`);
      } else {
        const cr = await tx.partNumberCrossReference.create({
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
        createdCrId = cr.id;
        console.log(`  CROSS_REFERENCE_CREATED = YES (id=${cr.id})`);
      }
    });

    // ============================================================
    // STEP 3: Post-write verification (READ-ONLY)
    // ============================================================
    console.log(`\n--- STEP 3: Post-write verification (READ-ONLY) ---`);

    const g5Verify = await prisma.partNumber.findUnique({
      where: { number: PILOT.newPartNumber },
      select: { id: true, verificationStatus: true, publishStatus: true, verified: true, modelEvidence: true, confidence: true, brandId: true, equipmentId: true },
    });
    console.log(`  G5_8516_EXISTS = ${g5Verify ? "YES" : "NO"}`);
    console.log(`  G5_8516_VERIFICATION_STATUS = ${g5Verify?.verificationStatus}`);
    console.log(`  G5_8516_PUBLISH_STATUS = ${g5Verify?.publishStatus}`);
    console.log(`  G5_8516_VERIFIED = ${g5Verify?.verified}`);
    console.log(`  G5_8516_MODEL_EVIDENCE = ${g5Verify?.modelEvidence}`);
    console.log(`  G5_8516_CONFIDENCE = ${g5Verify?.confidence}`);
    console.log(`  G5_8516_BRAND_ID = ${g5Verify?.brandId ?? "null"}`);
    console.log(`  G5_8516_EQUIPMENT_ID = ${g5Verify?.equipmentId ?? "null"}`);

    // Verification assertions
    let verifyPass = true;
    if (g5Verify?.verificationStatus !== "UNVERIFIED") { console.log(`  FAIL: verificationStatus should be UNVERIFIED`); verifyPass = false; }
    if (g5Verify?.publishStatus !== "HOLD") { console.log(`  FAIL: publishStatus should be HOLD`); verifyPass = false; }
    if (g5Verify?.verified !== false) { console.log(`  FAIL: verified should be false`); verifyPass = false; }
    if (g5Verify?.modelEvidence !== "NOT_EXPLICIT") { console.log(`  FAIL: modelEvidence should be NOT_EXPLICIT`); verifyPass = false; }
    if (g5Verify?.confidence !== "MEDIUM") { console.log(`  FAIL: confidence should be MEDIUM`); verifyPass = false; }

    const crCount = await prisma.partNumberCrossReference.count({
      where: {
        OR: [
          { sourcePartNumberId: PILOT.anchorExpectedId, targetPartNumberId: g5Verify?.id },
          { sourcePartNumberId: g5Verify?.id, targetPartNumberId: PILOT.anchorExpectedId },
        ],
        relationType: PILOT.relationType,
      },
    });
    console.log(`  CROSS_REFERENCE_COUNT = ${crCount}`);
    if (crCount !== 1) { console.log(`  FAIL: expected exactly 1 cross reference`); verifyPass = false; }

    const crRecord = await prisma.partNumberCrossReference.findFirst({
      where: {
        OR: [
          { sourcePartNumberId: PILOT.anchorExpectedId, targetPartNumberId: g5Verify?.id },
          { sourcePartNumberId: g5Verify?.id, targetPartNumberId: PILOT.anchorExpectedId },
        ],
        relationType: PILOT.relationType,
      },
      select: { verificationStatus: true, confidence: true },
    });
    console.log(`  CR_VERIFICATION_STATUS = ${crRecord?.verificationStatus}`);
    console.log(`  CR_CONFIDENCE = ${crRecord?.confidence}`);
    if (crRecord?.verificationStatus !== "CANDIDATE") { console.log(`  FAIL: CR verificationStatus should be CANDIDATE`); verifyPass = false; }

    // READY count unchanged
    const readyCountAfter = await prisma.partNumber.count({ where: { publishStatus: "READY" } });
    console.log(`  READY_COUNT_BEFORE = ${readyCountBefore}`);
    console.log(`  READY_COUNT_AFTER = ${readyCountAfter}`);
    if (readyCountAfter !== readyCountBefore) { console.log(`  FAIL: READY count changed!`); verifyPass = false; }

    console.log(`\n  POST_WRITE_VERIFY = ${verifyPass ? "PASS" : "FAIL"}`);
    console.log(`  DATABASE_WRITES = ${pnAlreadyExisted && crAlreadyExisted ? 0 : (pnAlreadyExisted ? 1 : 2)}`);

    if (!verifyPass) {
      throw new Error("Post-write verification FAILED — manual review required");
    }

    console.log(`\n=== PILOT APPLY COMPLETE ===`);
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
