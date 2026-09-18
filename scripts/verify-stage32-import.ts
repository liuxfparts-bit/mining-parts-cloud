/**
 * ============================================================
 * V3.1 Stage 3.2D 10-PN 导入后只读验证
 *   npm run verify:stage32-import
 * 100% READ-ONLY：findMany/findFirst/count/include
 * 禁止 create/update/delete/upsert/executeRaw写
 *
 * 验证确定的 10 个 SINGLE PN（按 partNumber 升序前 10）：
 *   016-15015, 016-63012, 016-63028, 016-92009, 016-93020,
 *   06575109, 06575111, 06575124, 06581411, 100202
 * ============================================================
 */
const TARGET_PNS = [
  "016-15015", "016-63012", "016-63028", "016-92009", "016-93020",
  "06575109", "06575111", "06575124", "06581411", "100202",
];

async function main() {
  console.log(`\n=== V3.1 Stage 3.2D 10-PN 导入后只读验证 ===\n`);
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  // 1) 总 count
  const totalCount = await prisma.partNumber.count();
  console.log(`PART_NUMBER_COUNT = ${totalCount}`);

  // 2) 逐个查目标 PN
  let found = 0;
  let missing = 0;
  let relationsValid = true;
  let auditValid = true;
  let statusValid = true;

  for (const pn of TARGET_PNS) {
    const rec = await prisma.partNumber.findFirst({
      where: { number: pn },
      select: {
        id: true, number: true, normalizedPartNumber: true, slug: true,
        name: true, verificationStatus: true, publishStatus: true, verified: true, modelEvidence: true, confidence: true, lastVerifiedAt: true,
        brand: { select: { id: true, name: true, nameEn: true } },
        equipmentRelations: { select: { id: true, equipmentModel: { select: { id: true, model: true } }, verificationStatus: true, evidenceStatus: true } },
        auditLogs: { select: { id: true, action: true, reason: true, newVerification: true, newPublishStatus: true } },
      },
    });
    if (!rec) {
      console.log(`  [MISSING] ${pn}`);
      missing++;
      continue;
    }
    found++;
    const relModels = rec.equipmentRelations.map((r) => r.equipmentModel.model).join(",");
    const auditActions = rec.auditLogs.map((a) => a.action).join(",");
    console.log(`  [FOUND] ${pn}  id=${rec.id}  slug=${rec.slug}  norm=${rec.normalizedPartNumber}`);
    console.log(`          brand=${rec.brand?.nameEn}(${rec.brand?.id})  status=${rec.verificationStatus}/${rec.publishStatus}  verified=${rec.verified}  modelEv=${rec.modelEvidence}  conf=${rec.confidence}  lastVer=${rec.lastVerifiedAt}`);
    console.log(`          relations=[${relModels}]  audit=[${auditActions}]`);

    // 状态校验
    if (rec.verificationStatus !== "VERIFIED" || rec.publishStatus !== "READY" || rec.verified !== true) {
      statusValid = false;
      console.log(`          ⚠️ STATUS_INVALID`);
    }
    // 关系校验：至少 1 条
    if (rec.equipmentRelations.length < 1) {
      relationsValid = false;
      console.log(`          ⚠️ NO_EQUIPMENT_RELATION`);
    }
    // Audit 校验：至少 1 条 IMPORT_CREATE
    if (!rec.auditLogs.some((a) => a.action === "IMPORT_CREATE")) {
      auditValid = false;
      console.log(`          ⚠️ NO_IMPORT_CREATE_AUDIT`);
    }
  }

  console.log(`\n--- 验证汇总 ---`);
  console.log(`TARGET_10_FOUND = ${found}`);
  console.log(`TARGET_10_MISSING = ${missing}`);
  console.log(`TARGET_RELATIONS_VALID = ${relationsValid ? "PASS" : "FAIL"}`);
  console.log(`TARGET_AUDIT_VALID = ${auditValid ? "PASS" : "FAIL"}`);
  console.log(`TARGET_STATUS_VALID = ${statusValid ? "PASS" : "FAIL"}`);

  const allPass = found === 10 && missing === 0 && relationsValid && auditValid && statusValid;
  console.log(`STAGE32_10_IMPORT_VERIFY = ${allPass ? "PASS" : "FAIL"}`);

  await prisma.$disconnect();
  console.log(`\n=== 验证完成（100% READ-ONLY，未写库）===\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
export {};
