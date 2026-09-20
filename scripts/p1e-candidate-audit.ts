/**
 * Stage 3.6C-P1-E1 Candidate PartNumber Safety Audit
 *
 * 只读审计脚本。对指定的20个 HOLD/UNVERIFIED PN 做关联审计，
 * 找出最适合作为临时 production test fixture 的 PN。
 *
 * 用法：
 *   npx tsx scripts/p1e-candidate-audit.ts
 *
 * 安全：只读，不写数据库。DATABASE_WRITES = 0。
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 用户指定的20个候选 PN number
const CANDIDATE_NUMBERS = [
  "XP210162",
  "XP123456",
  "XP987654",
  "A2U220-324006",
  "A2U220-324007",
  "A2U220-324008",
  "100080382",
  "100080383",
  "100080384",
  "137-97-01500-9-01",
  "137-97-01500-9-02",
  "137-97-01500-9-03",
  "HD30-110200",
  "HD30-110201",
  "SL300-5501",
  "SL300-5502",
  "FF-6001",
  "SA6701-100",
  "SA6701-101",
  "SA6701-102",
];

async function main() {
  console.log("=== Stage 3.6C-P1-E1 Candidate PN Safety Audit ===");
  console.log(`DATABASE_WRITES = 0 (read-only)\n`);

  // 1. 确认 id=1 未变化
  const pilot = await prisma.partNumberCrossReference.findUnique({ where: { id: 1 } });
  if (pilot) {
    console.log(
      `Pilot id=1: source=${pilot.sourcePartNumberId} target=${pilot.targetPartNumberId} ` +
        `type=${pilot.relationType} status=${pilot.verificationStatus} confidence=${pilot.confidence}`
    );
  } else {
    console.log("WARN: Pilot id=1 not found");
  }

  const readyCount = await prisma.partNumber.count({ where: { publishStatus: "READY" } });
  console.log(`READY_COUNT = ${readyCount}\n`);

  // 2. 查询20个候选 PN
  const pns = await prisma.partNumber.findMany({
    where: { number: { in: CANDIDATE_NUMBERS } },
    orderBy: { id: "asc" },
    include: {
      brand: { select: { id: true, name: true, nameEn: true, slug: true } },
      equipmentRelations: {
        include: { equipmentModel: { select: { id: true, model: true, name: true } } },
      },
      products: { select: { id: true, status: true, verificationStatus: true } },
      crossReferencesAsSource: { select: { id: true, relationType: true, verificationStatus: true } },
      crossReferencesAsTarget: { select: { id: true, relationType: true, verificationStatus: true } },
    },
  });

  console.log(`Found ${pns.length} of ${CANDIDATE_NUMBERS.length} specified candidate PN\n`);

  // 检查哪些没找到
  const foundNumbers = new Set(pns.map((p) => p.number));
  const missing = CANDIDATE_NUMBERS.filter((n) => !foundNumbers.has(n));
  if (missing.length > 0) {
    console.log(`NOT FOUND in database: ${missing.join(", ")}\n`);
  }

  // 3. 对每个 PN 做详细审计
  console.log("=".repeat(120));
  console.log(
    "ID".padEnd(6) +
      "NUMBER".padEnd(22) +
      "BRAND".padEnd(12) +
      "VERIFY".padEnd(12) +
      "PUBLISH".padEnd(10) +
      "EQ_REL".padEnd(8) +
      "PROD".padEnd(6) +
      "CR_REF".padEnd(8) +
      "CREATED"
  );
  console.log("=".repeat(120));

  const auditResults = [];

  for (const pn of pns) {
    const eqCount = pn.equipmentRelations.length;
    const eqModels = pn.equipmentRelations.map((r) => r.equipmentModel.model).join(",");
    const productCount = pn.products.length;
    const crCount = pn.crossReferencesAsSource.length + pn.crossReferencesAsTarget.length;

    // Product 即 SupplierProduct（schema 中 Product model 直接含 partNumberId + supplierId）
    // pn.products 已经是 Product[]，所以 productCount 即为 SupplierProduct 数量
    const supplierProductCount = productCount;

    // RFQ 关联（通过 RFQItem.partNumberId，schema 中 RFQItem 有 partNumberId Int?）
    let rfqCount = 0;
    let rfqInfo = "N/A";
    try {
      rfqCount = await prisma.rFQItem.count({ where: { partNumberId: pn.id } });
      rfqInfo = `${rfqCount} items`;
    } catch {
      rfqInfo = "query error";
    }

    const brandName = pn.brand?.name || pn.brand?.nameEn || "(none)";
    const createdStr = pn.createdAt ? new Date(pn.createdAt).toISOString().slice(0, 10) : "?";

    console.log(
      String(pn.id).padEnd(6) +
        pn.number.padEnd(22) +
        String(brandName).padEnd(12) +
        String(pn.verificationStatus).padEnd(12) +
        String(pn.publishStatus).padEnd(10) +
        String(eqCount).padEnd(8) +
        String(productCount).padEnd(6) +
        String(crCount).padEnd(8) +
        createdStr
    );

    auditResults.push({
      id: pn.id,
      number: pn.number,
      name: pn.name,
      brand: brandName,
      brandId: pn.brandId,
      verificationStatus: pn.verificationStatus,
      publishStatus: pn.publishStatus,
      verified: pn.verified,
      modelEvidence: pn.modelEvidence,
      confidence: pn.confidence,
      eqCount,
      eqModels,
      productCount,
      supplierProductCount,
      rfqInfo,
      crCount,
      createdAt: pn.createdAt,
      updatedAt: pn.updatedAt,
      lastVerifiedAt: pn.lastVerifiedAt,
      sourceFiles: pn.sourceFiles,
      evidenceSummary: pn.evidenceSummary,
    });
  }

  // 4. 详细输出每个 PN
  console.log("\n" + "=".repeat(120));
  console.log("DETAILED AUDIT");
  console.log("=".repeat(120));

  for (const r of auditResults) {
    console.log(`\n--- id=${r.id}  ${r.number} ---`);
    console.log(`  name: ${r.name || "(none)"}`);
    console.log(`  brand: ${r.brand} (id=${r.brandId})`);
    console.log(`  verificationStatus: ${r.verificationStatus}`);
    console.log(`  publishStatus: ${r.publishStatus}`);
    console.log(`  verified: ${r.verified}`);
    console.log(`  modelEvidence: ${r.modelEvidence}`);
    console.log(`  confidence: ${r.confidence}`);
    console.log(`  equipmentRelations: ${r.eqCount} [${r.eqModels}]`);
    console.log(`  products: ${r.productCount}`);
    console.log(`  supplierProducts: ${r.supplierProductCount}`);
    console.log(`  RFQ: ${r.rfqInfo}`);
    console.log(`  crossReferences: ${r.crCount}`);
    console.log(`  createdAt: ${r.createdAt?.toISOString()}`);
    console.log(`  updatedAt: ${r.updatedAt?.toISOString()}`);
    console.log(`  lastVerifiedAt: ${r.lastVerifiedAt ? r.lastVerifiedAt.toISOString() : "(null)"}`);
    console.log(`  sourceFiles: ${r.sourceFiles || "(none)"}`);
    if (r.evidenceSummary) {
      console.log(`  evidenceSummary: ${r.evidenceSummary.slice(0, 100)}...`);
    }
  }

  // 5. 安全性评分：无关联的 PN 最安全
  console.log("\n" + "=".repeat(120));
  console.log("SAFETY RANKING (fewer associations = safer for test fixture)");
  console.log("=".repeat(120));

  const scored = auditResults.map((r) => ({
    ...r,
    safetyScore: r.eqCount * 10 + r.productCount * 5 + r.supplierProductCount * 5 + r.crCount * 20,
  }));
  scored.sort((a, b) => a.safetyScore - b.safetyScore);

  console.log(
    "\n" +
      "RANK".padEnd(6) +
      "ID".padEnd(6) +
      "NUMBER".padEnd(22) +
      "PUBLISH".padEnd(10) +
      "EQ".padEnd(5) +
      "PROD".padEnd(6) +
      "SPROD".padEnd(7) +
      "CR".padEnd(5) +
      "SCORE"
  );
  scored.forEach((r, i) => {
    console.log(
      String(i + 1).padEnd(6) +
        String(r.id).padEnd(6) +
        r.number.padEnd(22) +
        String(r.publishStatus).padEnd(10) +
        String(r.eqCount).padEnd(5) +
        String(r.productCount).padEnd(6) +
        String(r.supplierProductCount).padEnd(7) +
        String(r.crCount).padEnd(5) +
        String(r.safetyScore)
    );
  });

  // 6. 推荐：选择4个最安全的 PN，组成2对
  // 优先：HOLD + UNVERIFIED + 无EQ + 无PROD + 无CR
  const safest = scored.filter(
    (r) => r.publishStatus === "HOLD" && r.verificationStatus === "UNVERIFIED" && r.eqCount === 0 && r.productCount === 0 && r.crCount === 0
  );

  console.log("\n" + "=".repeat(120));
  console.log("RECOMMENDATION");
  console.log("=".repeat(120));

  if (safest.length >= 4) {
    console.log(`\nFound ${safest.length} PN with zero associations (HOLD + UNVERIFIED + no EQ + no PROD + no CR):`);
    safest.slice(0, 8).forEach((r, i) => {
      console.log(`  ${i + 1}. id=${r.id} ${r.number} (created=${r.createdAt?.toISOString().slice(0, 10)})`);
    });
    console.log(`\nRECOMMENDED_VERIFY_PAIR: id=${safest[0].id} (${safest[0].number}) <-> id=${safest[1].id} (${safest[1].number})`);
    console.log(`RECOMMENDED_REJECT_PAIR: id=${safest[2].id} (${safest[2].number}) <-> id=${safest[3].id} (${safest[3].number})`);
  } else {
    console.log(`\nOnly ${safest.length} PN with zero associations. Need to relax criteria.`);
    console.log("Top 8 safest overall:");
    scored.slice(0, 8).forEach((r, i) => {
      console.log(
        `  ${i + 1}. id=${r.id} ${r.number} publish=${r.publishStatus} verify=${r.verificationStatus} eq=${r.eqCount} prod=${r.productCount} cr=${r.crCount}`
      );
    });
  }

  console.log("\n\nDATABASE_WRITES = 0");
  console.log("FIXTURE_CREATED = NO");
  console.log("AUDIT COMPLETE");
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
