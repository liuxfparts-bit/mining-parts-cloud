/**
 * Stage 3.6C-P1-E Production Test Fixture (TEST-ONLY)
 *
 * 使用4个专用临时 TEST PartNumber + 2个 TEST CrossReference，
 * 完全隔离真实业务数据。不使用任何现有 HOLD PN。
 *
 * 默认 DRY-RUN（只读审计，不写数据库）。
 *
 * 用法：
 *   npx tsx scripts/p1e-cross-reference-fixture.ts
 *     → 只读审计：确认 id=1 未变化、READY_COUNT、TEST fixture 状态
 *
 *   npx tsx scripts/p1e-cross-reference-fixture.ts --create-test-fixtures --apply
 *     → 创建4个 TEST PN + 2个 TEST CrossReference（幂等）
 *
 *   npx tsx scripts/p1e-cross-reference-fixture.ts --cleanup-test-fixtures --apply
 *     → 删除2个 TEST CrossReference + 4个 TEST PN（幂等、安全）
 *
 * 安全保证：
 * - 创建/清理前确认 CrossReference id=1 完全未变化
 * - 创建/清理后确认 READY_COUNT = 160
 * - TEST PN 编号极其明显（P1E-TEST-*），不模拟真实 OEM PN
 * - TEST PN: publishStatus=HOLD, verificationStatus=UNVERIFIED, 无 Brand/Equipment/Product
 * - TEST CrossReference: sourceReference 带明确 TEST marker
 * - cleanup 只删除明确 TEST marker + explicit ID + 状态验证通过的记录
 * - 禁止 broad delete（deleteMany({ publishStatus: HOLD }) 等）
 * - 不修改任何真实业务 PartNumber / Product / RFQ
 */

import { PrismaClient } from "@prisma/client";

// 独立 CLI 脚本使用自己的 PrismaClient 实例，不依赖 Next.js application singleton
const prisma = new PrismaClient();

// ========== TEST PN 定义 ==========
const TEST_NAME = "P1-E PRODUCTION TEST ONLY — NOT BUSINESS DATA";
const TEST_CATEGORY = "Uncategorized";
const TEST_EVIDENCE =
  "P1-E PRODUCTION TEST ONLY — NOT BUSINESS DATA. Created for Stage 3.6C-P1-E Cross Reference review state machine validation.";

interface TestPNConfig {
  number: string;
  slug: string;
  normalized: string;
  role: string;
}

const TEST_PNS: TestPNConfig[] = [
  { number: "P1E-TEST-VERIFY-SOURCE", slug: "p1e-test-verify-source", normalized: "P1ETESTVERIFYSOURCE", role: "VERIFY-SOURCE" },
  { number: "P1E-TEST-VERIFY-TARGET", slug: "p1e-test-verify-target", normalized: "P1ETESTVERIFYTARGET", role: "VERIFY-TARGET" },
  { number: "P1E-TEST-REJECT-SOURCE", slug: "p1e-test-reject-source", normalized: "P1ETESTREJECTSOURCE", role: "REJECT-SOURCE" },
  { number: "P1E-TEST-REJECT-TARGET", slug: "p1e-test-reject-target", normalized: "P1ETESTREJECTTARGET", role: "REJECT-TARGET" },
];

// ========== TEST CrossReference 定义 ==========
const TEST_MARKER_VERIFY = "P1-E TEST FIXTURE VERIFY — DO NOT USE AS BUSINESS DATA";
const TEST_MARKER_REJECT = "P1-E TEST FIXTURE REJECT — DO NOT USE AS BUSINESS DATA";

const TEST_CR_EVIDENCE_VERIFY =
  "P1-E PRODUCTION TEST ONLY — NOT BUSINESS DATA. Test fixture for VERIFY state transition validation. Technical equivalence not established.";
const TEST_CR_EVIDENCE_REJECT =
  "P1-E PRODUCTION TEST ONLY — NOT BUSINESS DATA. Test fixture for REJECT state transition validation. Technical equivalence not established.";

// ========== 安全断言 ==========
async function assertPilotUnchanged() {
  const pilot = await prisma.partNumberCrossReference.findUnique({ where: { id: 1 } });
  if (!pilot) {
    console.error("FAIL: CrossReference id=1 not found! Aborting.");
    process.exit(1);
  }
  const ok =
    pilot.sourcePartNumberId === 185 &&
    pilot.targetPartNumberId === 325 &&
    pilot.relationType === "POSSIBLE_MATCH" &&
    pilot.verificationStatus === "CANDIDATE" &&
    pilot.confidence === "MEDIUM" &&
    pilot.rejectionReason === null &&
    pilot.rejectedAt === null;
  if (!ok) {
    console.error("FAIL: CrossReference id=1 has changed! Aborting.");
    console.error(
      `  actual: source=${pilot.sourcePartNumberId} target=${pilot.targetPartNumberId} ` +
        `type=${pilot.relationType} status=${pilot.verificationStatus} confidence=${pilot.confidence}`
    );
    process.exit(1);
  }
  console.log("PASS: CrossReference id=1 unchanged (185<->325, POSSIBLE_MATCH, CANDIDATE, MEDIUM)");
}

async function assertReadyCount() {
  const count = await prisma.partNumber.count({ where: { publishStatus: "READY" } });
  console.log(`READY_COUNT = ${count}`);
  if (count !== 160) {
    console.error(`WARN: READY_COUNT = ${count}, expected 160`);
  }
  return count;
}

// ========== 查找 TEST PN ==========
async function findTestPNs() {
  const numbers = TEST_PNS.map((t) => t.number);
  const pns = await prisma.partNumber.findMany({
    where: { number: { in: numbers } },
    select: {
      id: true,
      number: true,
      slug: true,
      name: true,
      verificationStatus: true,
      publishStatus: true,
      verified: true,
      brandId: true,
      confidence: true,
      modelEvidence: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
  });
  return pns;
}

// ========== 查找 TEST CrossReference ==========
async function findTestCrossReferences() {
  const crs = await prisma.partNumberCrossReference.findMany({
    where: {
      OR: [{ sourceReference: TEST_MARKER_VERIFY }, { sourceReference: TEST_MARKER_REJECT }],
    },
    select: {
      id: true,
      sourcePartNumberId: true,
      targetPartNumberId: true,
      relationType: true,
      verificationStatus: true,
      confidence: true,
      sourceReference: true,
      rejectionReason: true,
      rejectedAt: true,
    },
    orderBy: { id: "asc" },
  });
  return crs;
}

// ========== 验证 TEST PN 状态安全（用于 cleanup 前检查）==========
function isTestPNSafe(pn: { number: string; publishStatus: string; verificationStatus: string; name: string }) {
  return (
    pn.number.startsWith("P1E-TEST-") &&
    pn.publishStatus === "HOLD" &&
    pn.verificationStatus === "UNVERIFIED" &&
    pn.name === TEST_NAME
  );
}

// ========== 创建 TEST Fixtures ==========
async function createTestFixtures(isApply: boolean) {
  console.log("\n=== CREATE TEST FIXTURES ===");

  // 1. 查找已存在的 TEST PN
  const existingPNs = await findTestPNs();
  const existingNumbers = new Set(existingPNs.map((p) => p.number));
  console.log(`Existing TEST PN: ${existingPNs.length}`);

  // 2. 创建缺失的 TEST PN
  const pnToCreate = TEST_PNS.filter((t) => !existingNumbers.has(t.number));
  console.log(`PN to create: ${pnToCreate.length}`);

  let createdPNCount = 0;
  if (isApply) {
    for (const config of pnToCreate) {
      // 幂等检查：再次确认不存在（race condition）
      const exists = await prisma.partNumber.findUnique({ where: { number: config.number } });
      if (exists) {
        console.log(`  SKIP (already exists): ${config.number}`);
        continue;
      }
      // slug unique 检查
      const slugExists = await prisma.partNumber.findUnique({ where: { slug: config.slug } });
      if (slugExists) {
        console.error(`  FAIL: slug collision for ${config.slug} (existing PN id=${slugExists.id})`);
        process.exit(1);
      }

      await prisma.partNumber.create({
        data: {
          number: config.number,
          slug: config.slug,
          normalizedPartNumber: config.normalized,
          name: TEST_NAME,
          category: TEST_CATEGORY,
          verificationStatus: "UNVERIFIED",
          publishStatus: "HOLD",
          verified: false,
          modelEvidence: "NOT_EXPLICIT",
          confidence: "LOW",
          brandId: null,
          evidenceSummary: TEST_EVIDENCE,
          sourceFiles: null,
        },
      });
      console.log(`  CREATED PN: ${config.number} (${config.role})`);
      createdPNCount++;
    }
  } else {
    pnToCreate.forEach((config) => {
      console.log(`  WOULD CREATE PN: ${config.number} (${config.role})`);
    });
  }

  // 3. 重新查询所有 TEST PN（获取 ID）
  const allTestPNs = await findTestPNs();
  const pnByNumber = new Map(allTestPNs.map((p) => [p.number, p]));

  // 4. 创建 TEST CrossReference
  const existingCRs = await findTestCrossReferences();
  const existingMarkers = new Set(existingCRs.map((c) => c.sourceReference));
  console.log(`\nExisting TEST CrossReference: ${existingCRs.length}`);

  const crConfigs = [
    {
      marker: TEST_MARKER_VERIFY,
      sourceNumber: "P1E-TEST-VERIFY-SOURCE",
      targetNumber: "P1E-TEST-VERIFY-TARGET",
      evidence: TEST_CR_EVIDENCE_VERIFY,
      label: "Fixture A (VERIFY path)",
    },
    {
      marker: TEST_MARKER_REJECT,
      sourceNumber: "P1E-TEST-REJECT-SOURCE",
      targetNumber: "P1E-TEST-REJECT-TARGET",
      evidence: TEST_CR_EVIDENCE_REJECT,
      label: "Fixture B (REJECT path)",
    },
  ];

  let createdCRCount = 0;
  for (const config of crConfigs) {
    if (existingMarkers.has(config.marker)) {
      console.log(`  SKIP (already exists): ${config.label}`);
      continue;
    }

    const sourcePN = pnByNumber.get(config.sourceNumber);
    const targetPN = pnByNumber.get(config.targetNumber);
    if (!sourcePN || !targetPN) {
      console.error(`  FAIL: TEST PN not found for ${config.label}`);
      process.exit(1);
    }

    // canonical ordering: sourceId < targetId
    const sourceId = Math.min(sourcePN.id, targetPN.id);
    const targetId = Math.max(sourcePN.id, targetPN.id);

    if (isApply) {
      // 幂等检查：确认该 pair + type 不存在
      const exists = await prisma.partNumberCrossReference.findFirst({
        where: { sourcePartNumberId: sourceId, targetPartNumberId: targetId, relationType: "POSSIBLE_MATCH" },
      });
      if (exists) {
        console.log(`  SKIP (CR already exists): ${config.label} (id=${exists.id})`);
        continue;
      }

      await prisma.partNumberCrossReference.create({
        data: {
          sourcePartNumberId: sourceId,
          targetPartNumberId: targetId,
          relationType: "POSSIBLE_MATCH",
          verificationStatus: "CANDIDATE",
          confidence: "LOW",
          evidenceSummary: config.evidence,
          sourceReference: config.marker,
        },
      });
      console.log(`  CREATED CR: ${config.label} (source=${sourceId} target=${targetId})`);
      createdCRCount++;
    } else {
      console.log(`  WOULD CREATE CR: ${config.label} (source=${sourceId} target=${targetId})`);
    }
  }

  console.log(`\nSummary: created PN=${createdPNCount}, created CR=${createdCRCount}`);
  if (!isApply) {
    console.log("DRY-RUN: no database writes. Use --apply to actually create.");
  }
}

// ========== Cleanup TEST Fixtures ==========
async function cleanupTestFixtures(isApply: boolean) {
  console.log("\n=== CLEANUP TEST FIXTURES ===");

  // 1. 查找 TEST CrossReference
  const testCRs = await findTestCrossReferences();
  console.log(`TEST CrossReference to delete: ${testCRs.length}`);
  testCRs.forEach((cr) => {
    console.log(`  id=${cr.id} source=${cr.sourcePartNumberId} target=${cr.targetPartNumberId} status=${cr.verificationStatus} marker=${cr.sourceReference?.substring(0, 50)}...`);
  });

  // 安全检查：没有 id=1
  const hasId1 = testCRs.some((cr) => cr.id === 1);
  if (hasId1) {
    console.error("FAIL: id=1 found in cleanup list! Aborting.");
    process.exit(1);
  }

  // 2. 删除 TEST CrossReference
  if (testCRs.length > 0) {
    const crIds = testCRs.map((cr) => cr.id);
    if (isApply) {
      const result = await prisma.partNumberCrossReference.deleteMany({
        where: { id: { in: crIds } },
      });
      console.log(`\nDeleted TEST CrossReference: ${result.count}`);
    } else {
      console.log(`\nWOULD DELETE TEST CrossReference: ${crIds.length} (ids: ${crIds.join(", ")})`);
    }
  }

  // 3. 查找 TEST PN
  const testPNs = await findTestPNs();
  console.log(`\nTEST PN to delete: ${testPNs.length}`);

  // 安全检查：每个 TEST PN 状态正确
  const unsafePNs = testPNs.filter((pn) => !isTestPNSafe(pn));
  if (unsafePNs.length > 0) {
    console.error("FAIL: Some TEST PN have unexpected state! Aborting cleanup.");
    unsafePNs.forEach((pn) => {
      console.error(`  id=${pn.id} number=${pn.number} publish=${pn.publishStatus} verify=${pn.verificationStatus} name=${pn.name}`);
    });
    process.exit(1);
  }

  // 安全检查：TEST PN 没有其他关联（Product/RFQ/Favorite/Equipment/AuditLog）
  for (const pn of testPNs) {
    const productCount = await prisma.product.count({ where: { partNumberId: pn.id } });
    const eqCount = await prisma.partNumberEquipment.count({ where: { partNumberId: pn.id } });
    const favoriteCount = await prisma.favorite.count({ where: { partNumberId: pn.id } });
    const auditCount = await prisma.partNumberAuditLog.count({ where: { partNumberId: pn.id } });
    const rfqItemCount = await prisma.rFQItem.count({ where: { partNumberId: pn.id } });

    if (productCount > 0 || eqCount > 0 || favoriteCount > 0 || auditCount > 0 || rfqItemCount > 0) {
      console.error(
        `FAIL: TEST PN id=${pn.id} number=${pn.number} has unexpected associations! ` +
          `products=${productCount} eq=${eqCount} favorites=${favoriteCount} audit=${auditCount} rfqItems=${rfqItemCount}`
      );
      process.exit(1);
    }
    console.log(`  SAFE: id=${pn.id} number=${pn.number} (no Product/Equipment/Favorite/AuditLog/RFQItem)`);
  }

  // 4. 删除 TEST PN
  if (testPNs.length > 0) {
    const pnIds = testPNs.map((pn) => pn.id);
    if (isApply) {
      const result = await prisma.partNumber.deleteMany({
        where: { id: { in: pnIds } },
      });
      console.log(`\nDeleted TEST PN: ${result.count}`);
    } else {
      console.log(`\nWOULD DELETE TEST PN: ${pnIds.length} (ids: ${pnIds.join(", ")})`);
    }
  }

  // 5. 验证清理完成
  if (isApply) {
    const remainingCRs = await findTestCrossReferences();
    const remainingPNs = await findTestPNs();
    console.log(`\nPost-cleanup: remaining TEST CR=${remainingCRs.length}, TEST PN=${remainingPNs.length}`);
    if (remainingCRs.length !== 0 || remainingPNs.length !== 0) {
      console.error("FAIL: cleanup incomplete");
      process.exit(1);
    }
    console.log("PASS: cleanup complete");
  } else {
    console.log("\nDRY-RUN: no database writes. Use --apply to actually cleanup.");
  }
}

// ========== 只读审计 ==========
async function audit() {
  console.log("\n=== READ-ONLY AUDIT ===");

  const testPNs = await findTestPNs();
  console.log(`\nTEST PN (${testPNs.length}/4):`);
  if (testPNs.length === 0) {
    console.log("  (none — not created yet)");
  }
  testPNs.forEach((pn) => {
    console.log(
      `  id=${pn.id} number=${pn.number} publish=${pn.publishStatus} verify=${pn.verificationStatus} ` +
        `verified=${pn.verified} brandId=${pn.brandId} confidence=${pn.confidence}`
    );
  });

  const testCRs = await findTestCrossReferences();
  console.log(`\nTEST CrossReference (${testCRs.length}/2):`);
  if (testCRs.length === 0) {
    console.log("  (none — not created yet)");
  }
  testCRs.forEach((cr) => {
    console.log(
      `  id=${cr.id} source=${cr.sourcePartNumberId} target=${cr.targetPartNumberId} ` +
        `type=${cr.relationType} status=${cr.verificationStatus} confidence=${cr.confidence}`
    );
  });

  console.log("\nDATABASE_WRITES = 0 (audit complete)");
}

// ========== Main ==========
async function main() {
  const args = process.argv.slice(2);
  const isCreate = args.includes("--create-test-fixtures");
  const isCleanup = args.includes("--cleanup-test-fixtures");
  const isApply = args.includes("--apply");

  console.log("=== Stage 3.6C-P1-E Production Test Fixture (TEST-ONLY) ===");
  console.log(`NODE_ENV = ${process.env.NODE_ENV || "(not set)"}`);
  console.log(`Args: ${args.join(" ") || "(none — read-only audit)"}`);
  console.log("");

  // 1. 安全断言
  await assertPilotUnchanged();
  await assertReadyCount();

  // 2. 执行操作
  if (isCreate) {
    await createTestFixtures(isApply);
    if (isApply) {
      console.log("\n=== Post-create verification ===");
      await assertPilotUnchanged();
      await assertReadyCount();
    }
    return;
  }

  if (isCleanup) {
    await cleanupTestFixtures(isApply);
    if (isApply) {
      console.log("\n=== Post-cleanup verification ===");
      await assertPilotUnchanged();
      await assertReadyCount();
    }
    return;
  }

  // 默认：只读审计
  await audit();
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export {};
