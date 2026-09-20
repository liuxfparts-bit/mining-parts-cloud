/**
 * Stage 3.6C-P1-E Production Test Fixture
 *
 * 默认 DRY-RUN（只读审计，不写数据库）。
 *
 * 用法：
 *   npx tsx scripts/p1e-cross-reference-fixture.ts
 *     → 只读审计：确认 id=1 未变化、READY_COUNT、列出候选 PN
 *
 *   npx tsx scripts/p1e-cross-reference-fixture.ts --create-verify --apply
 *     → 创建 Fixture A（用于 VERIFY 路径测试）
 *
 *   npx tsx scripts/p1e-cross-reference-fixture.ts --create-reject --apply
 *     → 创建 Fixture B（用于 REJECT 路径测试）
 *
 *   npx tsx scripts/p1e-cross-reference-fixture.ts --cleanup --apply
 *     → 删除所有 P1-E TEST fixture（只删 sourceReference 匹配的记录）
 *
 * 安全保证：
 * - 创建前确认 CrossReference id=1 完全未变化
 * - 只使用 HOLD 状态 PN（非公开，不影响 READY_COUNT）
 * - 不使用 id=185 / id=325
 * - 不修改任何 PartNumber
 * - fixture 有极其明显的 TEST 标记
 * - cleanup 只删除明确 TEST_FIXTURE_ID 且 sourceReference 匹配的记录
 */

import { prisma } from "../src/lib/prisma";

const TEST_MARKER_VERIFY = "P1-E TEST FIXTURE VERIFY — DO NOT USE AS BUSINESS DATA";
const TEST_MARKER_REJECT = "P1-E TEST FIXTURE REJECT — DO NOT USE AS BUSINESS DATA";
const EVIDENCE_SUMMARY =
  "Temporary production verification fixture for Stage 3.6C-P1-E. Not a technical equivalence claim. TEST ONLY. NOT BUSINESS DATA.";

const PROTECTED_PART_NUMBER_IDS = [185, 325];

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
  console.log("PASS: CrossReference id=1 unchanged (185<->325, POSSIBLE_MATCH, CANDIDATE, MEDIUM, rejectionReason=null, rejectedAt=null)");
}

async function assertReadyCount() {
  const count = await prisma.partNumber.count({ where: { publishStatus: "READY" } });
  console.log(`READY_COUNT = ${count}`);
  if (count !== 160) {
    console.error(`WARN: READY_COUNT = ${count}, expected 160`);
  }
  return count;
}

async function findCandidatePartNumbers() {
  // 选择 HOLD 状态 PN（非公开，不影响前台），排除受保护 ID
  const candidates = await prisma.partNumber.findMany({
    where: {
      publishStatus: "HOLD",
      id: { notIn: PROTECTED_PART_NUMBER_IDS },
    },
    orderBy: { id: "asc" },
    take: 20,
    select: {
      id: true,
      number: true,
      verificationStatus: true,
      publishStatus: true,
      verified: true,
      brandId: true,
      equipmentId: true,
    },
  });

  console.log(`\nFound ${candidates.length} HOLD PartNumber candidates (excluding id=185,325):`);
  candidates.forEach((pn) => {
    console.log(`  id=${pn.id} number=${pn.number} verification=${pn.verificationStatus} publish=${pn.publishStatus}`);
  });

  if (candidates.length < 2) {
    console.error("FAIL: Need at least 2 HOLD PN candidates");
    process.exit(1);
  }

  // 选择前两个，确保 sourceId < targetId（canonical ordering for POSSIBLE_MATCH）
  const first = candidates[0];
  const second = candidates[1];
  const sourceId = Math.min(first.id, second.id);
  const targetId = Math.max(first.id, second.id);
  const source = candidates.find((c) => c.id === sourceId)!;
  const target = candidates.find((c) => c.id === targetId)!;

  // 确认两 PN 之间没有现有 CrossReference
  const existing = await prisma.partNumberCrossReference.findFirst({
    where: {
      OR: [
        { sourcePartNumberId: sourceId, targetPartNumberId: targetId },
        { sourcePartNumberId: targetId, targetPartNumberId: sourceId },
      ],
    },
  });
  if (existing) {
    console.error(`FAIL: CrossReference already exists between id=${sourceId} and id=${targetId} (cr id=${existing.id})`);
    process.exit(1);
  }

  console.log(`\nSelected fixture pair:`);
  console.log(`  SOURCE: id=${source.id} number=${source.number}`);
  console.log(`  TARGET: id=${target.id} number=${target.number}`);
  console.log(`  (canonical ordering: sourceId=${sourceId} < targetId=${targetId})`);

  return { source, target };
}

async function snapshotPartNumber(id: number, label: string) {
  const pn = await prisma.partNumber.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      verificationStatus: true,
      publishStatus: true,
      verified: true,
      brandId: true,
      equipmentId: true,
    },
  });
  if (!pn) {
    console.error(`FAIL: PartNumber id=${id} not found`);
    process.exit(1);
  }
  const eqCount = await prisma.partNumberEquipment.count({ where: { partNumberId: id } });
  console.log(
    `  ${label}: id=${pn.id} number=${pn.number} verification=${pn.verificationStatus} ` +
      `publish=${pn.publishStatus} verified=${pn.verified} brandId=${pn.brandId} equipmentId=${pn.equipmentId} equipmentRelations=${eqCount}`
  );
  return { ...pn, equipmentRelationCount: eqCount };
}

async function createFixture(marker: string, label: string) {
  const { source, target } = await findCandidatePartNumbers();

  // 检查该 marker 的 fixture 是否已存在
  const existing = await prisma.partNumberCrossReference.findFirst({
    where: { sourceReference: marker },
  });
  if (existing) {
    console.log(`\n${label} fixture already exists: id=${existing.id}`);
    console.log(`  source=${existing.sourcePartNumberId} target=${existing.targetPartNumberId} status=${existing.verificationStatus}`);
    return existing.id;
  }

  // PartNumber before snapshot
  console.log(`\n${label} — PartNumber BEFORE snapshot:`);
  await snapshotPartNumber(source.id, "SOURCE");
  await snapshotPartNumber(target.id, "TARGET");

  const fixture = await prisma.partNumberCrossReference.create({
    data: {
      sourcePartNumberId: source.id,
      targetPartNumberId: target.id,
      relationType: "POSSIBLE_MATCH",
      verificationStatus: "CANDIDATE",
      confidence: "LOW",
      evidenceSummary: EVIDENCE_SUMMARY,
      sourceReference: marker,
    },
  });

  console.log(`\n${label} fixture CREATED:`);
  console.log(`  TEST_FIXTURE_ID = ${fixture.id}`);
  console.log(`  source=${fixture.sourcePartNumberId} target=${fixture.targetPartNumberId}`);
  console.log(`  relationType=${fixture.relationType} verificationStatus=${fixture.verificationStatus} confidence=${fixture.confidence}`);
  console.log(`  sourceReference=${fixture.sourceReference}`);

  return fixture.id;
}

async function cleanup() {
  // 只删除 sourceReference 匹配 TEST marker 的记录
  // 绝对不删除 id=1
  const fixtures = await prisma.partNumberCrossReference.findMany({
    where: {
      OR: [{ sourceReference: TEST_MARKER_VERIFY }, { sourceReference: TEST_MARKER_REJECT }],
    },
    select: { id: true, sourceReference: true, verificationStatus: true },
  });

  console.log(`\nFound ${fixtures.length} P1-E TEST fixtures to cleanup:`);
  fixtures.forEach((f) => {
    console.log(`  id=${f.id} status=${f.verificationStatus} marker=${f.sourceReference?.substring(0, 40)}...`);
  });

  if (fixtures.length === 0) {
    console.log("No fixtures to cleanup.");
    return;
  }

  // 安全检查：没有 id=1
  const hasId1 = fixtures.some((f) => f.id === 1);
  if (hasId1) {
    console.error("FAIL: id=1 found in cleanup list! Aborting.");
    process.exit(1);
  }

  const ids = fixtures.map((f) => f.id);
  const result = await prisma.partNumberCrossReference.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`\nCleanup: deleted ${result.count} fixtures`);

  // 确认删除
  const remaining = await prisma.partNumberCrossReference.count({
    where: {
      OR: [{ sourceReference: TEST_MARKER_VERIFY }, { sourceReference: TEST_MARKER_REJECT }],
    },
  });
  console.log(`Remaining P1-E TEST fixtures: ${remaining}`);
  if (remaining !== 0) {
    console.error("FAIL: cleanup incomplete");
    process.exit(1);
  }
  console.log("PASS: cleanup complete");
}

async function main() {
  const args = process.argv.slice(2);
  const isCreateVerify = args.includes("--create-verify");
  const isCreateReject = args.includes("--create-reject");
  const isCleanup = args.includes("--cleanup");
  const isApply = args.includes("--apply");

  console.log("=== Stage 3.6C-P1-E Production Test Fixture ===");
  console.log(`NODE_ENV = ${process.env.NODE_ENV || "(not set)"}`);
  console.log(`Args: ${args.join(" ") || "(none — dry-run audit)"}`);
  console.log("");

  // 1. 确认 pilot id=1 未变化
  await assertPilotUnchanged();

  // 2. READY_COUNT
  await assertReadyCount();

  if (isCleanup) {
    if (!isApply) {
      console.log("\nDRY-RUN: would cleanup P1-E TEST fixtures. Use --apply to actually delete.");
      // 仍然列出将要删除的
      const fixtures = await prisma.partNumberCrossReference.findMany({
        where: { OR: [{ sourceReference: TEST_MARKER_VERIFY }, { sourceReference: TEST_MARKER_REJECT }] },
        select: { id: true, verificationStatus: true },
      });
      console.log(`Would delete ${fixtures.length} fixtures: ${fixtures.map((f) => `id=${f.id}`).join(", ")}`);
      return;
    }
    await cleanup();
    // cleanup 后再次确认
    console.log("\n=== Post-cleanup verification ===");
    await assertPilotUnchanged();
    await assertReadyCount();
    return;
  }

  if (isCreateVerify || isCreateReject) {
    if (!isApply) {
      console.log("\nDRY-RUN: would create fixture. Use --apply to actually create.");
      await findCandidatePartNumbers();
      return;
    }

    if (isCreateVerify) {
      const id = await createFixture(TEST_MARKER_VERIFY, "Fixture A (VERIFY path)");
      console.log(`\n>>> TEST_FIXTURE_VERIFY_ID = ${id}`);
    }
    if (isCreateReject) {
      const id = await createFixture(TEST_MARKER_REJECT, "Fixture B (REJECT path)");
      console.log(`\n>>> TEST_FIXTURE_REJECT_ID = ${id}`);
    }

    // 创建后再次确认 pilot 和 READY_COUNT
    console.log("\n=== Post-create verification ===");
    await assertPilotUnchanged();
    await assertReadyCount();
    return;
  }

  // 默认：只读审计
  console.log("\n=== Read-only audit (no writes) ===");
  await findCandidatePartNumbers();

  // 列出现有 TEST fixtures（如果有）
  const existingFixtures = await prisma.partNumberCrossReference.findMany({
    where: { OR: [{ sourceReference: TEST_MARKER_VERIFY }, { sourceReference: TEST_MARKER_REJECT }] },
    select: { id: true, sourcePartNumberId: true, targetPartNumberId: true, verificationStatus: true, sourceReference: true },
  });
  console.log(`\nExisting P1-E TEST fixtures: ${existingFixtures.length}`);
  existingFixtures.forEach((f) => {
    console.log(`  id=${f.id} source=${f.sourcePartNumberId} target=${f.targetPartNumberId} status=${f.verificationStatus}`);
  });

  console.log("\nDATABASE_WRITES = 0 (dry-run audit complete)");
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
