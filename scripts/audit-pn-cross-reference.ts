/**
 * ============================================================
 * V3.1 Stage 3.6A — Part Number Identity & Cross Reference Audit
 * 100% READ-ONLY. 禁止任何写操作。
 *
 * 审计目标：
 *   1. 114-8516LFL 完整生产数据
 *   2. G5-8516 是否已存在（exact/normalized/slug/similar）
 *   3. 现有可复用字段/关系
 * ============================================================
 */
async function main() {
  console.log(`\n=== Stage 3.6A Part Number Cross Reference Audit (READ-ONLY) ===\n`);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // ============================================================
    // 1. 114-8516LFL 完整数据
    // ============================================================
    console.log(`--- [1] 114-8516LFL 完整生产数据 ---`);
    const pn = await prisma.partNumber.findUnique({
      where: { number: "114-8516LFL" },
      include: {
        brand: true,
        equipment: true,
        equipmentRelations: { include: { equipmentModel: true } },
        _count: { select: { products: true, rfqs: true, rfqItems: true, auditLogs: true } },
      },
    });

    if (!pn) {
      console.log(`PN_114_8516LFL_EXISTS = NO`);
    } else {
      console.log(`PN_114_8516LFL_EXISTS = YES`);
      console.log(`ID = ${pn.id}`);
      console.log(`NUMBER = ${pn.number}`);
      console.log(`NORMALIZED = ${pn.normalizedPartNumber ?? "(null)"}`);
      console.log(`SLUG = ${pn.slug}`);
      console.log(`NAME = ${pn.name}`);
      console.log(`NAME_EN = ${pn.nameEn ?? "(null)"}`);
      console.log(`ORIGINAL_DESCRIPTION_EN = ${pn.originalDescriptionEn ?? "(null)"}`);
      console.log(`ORIGINAL_DESCRIPTION_CN = ${pn.originalDescriptionCn ?? "(null)"}`);
      console.log(`BRAND = ${pn.brand?.name ?? "(null)"} (id=${pn.brandId ?? "null"})`);
      console.log(`CATEGORY = ${pn.category}`);
      console.log(`VERIFICATION_STATUS = ${pn.verificationStatus}`);
      console.log(`MODEL_EVIDENCE = ${pn.modelEvidence}`);
      console.log(`CONFIDENCE = ${pn.confidence}`);
      console.log(`PUBLISH_STATUS = ${pn.publishStatus}`);
      console.log(`LAST_VERIFIED_AT = ${pn.lastVerifiedAt ? pn.lastVerifiedAt.toISOString() : "(null)"}`);
      console.log(`EQUIPMENT_RELATIONS = ${pn.equipmentRelations.map((r) => r.equipmentModel.model).join(", ") || "(none)"}`);
      console.log(`LEGACY_EQUIPMENT_ID = ${pn.equipmentId ?? "(null)"} (${pn.equipment?.model ?? "none"})`);
      console.log(`PRODUCT_COUNT = ${pn._count.products}`);
      console.log(`RFQ_COUNT = ${pn._count.rfqs}`);
      console.log(`RFQ_ITEM_COUNT = ${pn._count.rfqItems}`);
      console.log(`AUDIT_LOG_COUNT = ${pn._count.auditLogs}`);
      console.log(`OLD_PART_NUMBER = ${pn.oldPartNumber ?? "(null)"}`);
      console.log(`NEW_PART_NUMBER = ${pn.newPartNumber ?? "(null)"}`);
      console.log(`ALTERNATIVE_PART_NUMBER = ${pn.alternativePartNumber ?? "(null)"}`);
      console.log(`OEM_STATUS = ${pn.oemStatus}`);

      // 审计日志详情
      if (pn._count.auditLogs > 0) {
        const logs = await prisma.partNumberAuditLog.findMany({
          where: { partNumberId: pn.id },
          orderBy: { createdAt: "asc" },
          take: 10,
        });
        console.log(`\n  AUDIT_LOGS (最近10条):`);
        for (const log of logs) {
          console.log(`    [${log.createdAt.toISOString()}] action=${log.action} oldVer=${log.oldVerification} newVer=${log.newVerification} oldPub=${log.oldPublishStatus} newPub=${log.newPublishStatus} reason=${log.reason?.slice(0, 60) ?? ""}`);
        }
      }
    }

    // ============================================================
    // 2. G5-8516 存在性检查
    // ============================================================
    console.log(`\n--- [2] G5-8516 存在性检查 ---`);

    // exact number
    const exactByNumber = await prisma.partNumber.findUnique({ where: { number: "G5-8516" } });
    console.log(`G5_8516_EXACT_EXISTS = ${exactByNumber ? `YES (id=${exactByNumber.id})` : "NO"}`);

    // normalized collision（先算 normalized）
    const normalizedG5 = "G58516"; // 简单去横线大写
    const byNormalized = await prisma.partNumber.findMany({ where: { normalizedPartNumber: normalizedG5 } });
    console.log(`G5_8516_NORMALIZED_COLLISION = ${byNormalized.length > 0 ? `YES (${byNormalized.length}条: ${byNormalized.map((p) => p.number).join(",")})` : "NO"}`);

    // slug collision
    const slugG5 = "g5-8516";
    const bySlug = await prisma.partNumber.findUnique({ where: { slug: slugG5 } });
    console.log(`G5_8516_SLUG_COLLISION = ${bySlug ? `YES (id=${bySlug.id}, number=${bySlug.number})` : "NO"}`);

    // similar records（contains G5 或 8516）
    const similar = await prisma.partNumber.findMany({
      where: {
        OR: [
          { number: { contains: "G5" } },
          { number: { contains: "8516" } },
          { normalizedPartNumber: { contains: "G58516" } },
        ],
      },
      take: 20,
      orderBy: { number: "asc" },
    });
    console.log(`G5_8516_SIMILAR_RECORDS = ${similar.length > 0 ? similar.map((p) => `${p.number}(id=${p.id},status=${p.publishStatus})`).join("; ") : "(无)"}`);

    // ============================================================
    // 3. 现有可复用字段/关系汇总
    // ============================================================
    console.log(`\n--- [3] 现有可复用字段/关系 ---`);
    console.log(`PartNumber.oldPartNumber = 旧件号（String?）`);
    console.log(`PartNumber.newPartNumber = 新件号（String?）`);
    console.log(`PartNumber.alternativePartNumber = 替代件号（String?）`);
    console.log(`PartNumber.oemStatus = OEM/AFTERMARKET/REPLACEMENT（String）`);
    console.log(`Product.oemNumber = OEM 件号（String?，Product 级文本）`);
    console.log(`Product.partNumberId = REQUIRED FK → 必须先有 PartNumber 才能挂 Product`);
    console.log(`RFQ.partNumberId = nullable FK + partNumberStr = 自由文本`);
    console.log(`RFQItem.partNumberId = nullable FK + partNumberStr = 自由文本`);
    console.log(`PartNumberEquipment = 多对多，含 evidenceStatus/verificationStatus/evidenceSummary/sourceReference`);
    console.log(`PartNumberAuditLog = action/oldVerification/newVerification/oldPublishStatus/newPublishStatus/reason/changedById`);

    console.log(`\n=== AUDIT COMPLETE (DATABASE_WRITES = 0) ===\n`);
  } catch (e: any) {
    console.error(`\n❌ AUDIT_ERROR: ${e.message || String(e)}`);
    console.error(`DATABASE_WRITES = 0 (READ-ONLY audit failed, no data modified)`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
export {};
