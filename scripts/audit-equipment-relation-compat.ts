/**
 * ============================================================
 * V3.1 Stage 3.5B-P0 — Equipment Relation Compatibility Audit
 * 100% READ-ONLY. 禁止任何写操作。
 *
 * 审计所有 ACTIVE Equipment：
 *   - legacy READY count（通过 PartNumber.equipmentId + publishStatus=READY）
 *   - relation READY count（通过 PartNumberEquipment + PartNumber.publishStatus=READY）
 *   - 找出 legacy READY > 0 AND relation READY = 0 的设备（兼容性风险）
 * ============================================================
 */
async function main() {
  console.log(`\n=== Stage 3.5B-P0 Equipment Relation Compatibility Audit (READ-ONLY) ===\n`);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // 1. 所有 ACTIVE Equipment
    const equipments = await prisma.equipment.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, model: true, name: true, brandId: true, slug: true },
      orderBy: { id: "asc" },
    });

    console.log(`ACTIVE_EQUIPMENT_COUNT = ${equipments.length}`);
    console.log(``);

    let legacyOnlyReadyCount = 0;
    const legacyOnlyReadyList: string[] = [];

    console.log(`--- 逐设备审计（legacy READY vs relation READY）---`);
    console.log(`ID | MODEL | BRAND_ID | LEGACY_READY | RELATION_READY | STATUS`);
    console.log(`---|-------|----------|--------------|----------------|-------`);

    for (const eq of equipments) {
      // legacy: PartNumber.equipmentId = eq.id AND publishStatus = READY
      const legacyReady = await prisma.partNumber.count({
        where: { equipmentId: eq.id, publishStatus: "READY" },
      });

      // relation: PartNumberEquipment.equipmentModelId = eq.id AND PartNumber.publishStatus = READY
      const relationReady = await prisma.partNumber.count({
        where: {
          equipmentRelations: { some: { equipmentModelId: eq.id } },
          publishStatus: "READY",
        },
      });

      let status = "OK";
      if (legacyReady > 0 && relationReady === 0) {
        status = "LEGACY_ONLY_READY ⚠️";
        legacyOnlyReadyCount++;
        legacyOnlyReadyList.push(`${eq.model}(id=${eq.id}, legacyReady=${legacyReady})`);
      } else if (legacyReady > 0 && relationReady > 0) {
        status = "BOTH (legacy+relation)";
      } else if (legacyReady === 0 && relationReady > 0) {
        status = "RELATION_ONLY (V3.1)";
      } else {
        status = "NONE";
      }

      console.log(`${eq.id} | ${eq.model} | ${eq.brandId} | ${legacyReady} | ${relationReady} | ${status}`);
    }

    console.log(``);
    console.log(`=== 兼容性审计结果 ===`);
    console.log(`LEGACY_ONLY_READY_EQUIPMENT_COUNT = ${legacyOnlyReadyCount}`);
    console.log(`LEGACY_ONLY_READY_EQUIPMENT_LIST = ${legacyOnlyReadyList.length > 0 ? legacyOnlyReadyList.join(", ") : "(无)"}`);

    if (legacyOnlyReadyCount > 0) {
      console.log(``);
      console.log(`⚠️  COMPATIBILITY_GATE = BLOCKED`);
      console.log(`存在 ${legacyOnlyReadyCount} 台设备只有 legacy READY relation、尚未建立 PartNumberEquipment。`);
      console.log(`直接切换 Source of Truth 会导致这些设备的公开 READY 件号数据消失。`);
      console.log(`请先处理这些设备的数据迁移，或设计过渡 fallback 方案。`);
    } else {
      console.log(``);
      console.log(`✅ COMPATIBILITY_GATE = PASS`);
      console.log(`所有 ACTIVE Equipment 要么已有 PartNumberEquipment READY relation，要么没有 legacy READY data。`);
      console.log(`可以安全切换公开 Equipment 页面的 Part Number Source of Truth 到 PartNumberEquipment。`);
    }

    // 2. 额外：ED10 / LS190 详细确认
    console.log(``);
    console.log(`--- ED10 / LS190 详细确认 ---`);
    for (const model of ["ED10", "LS190"]) {
      const eq = equipments.find((e) => e.model === model);
      if (!eq) {
        console.log(`${model}: NOT FOUND`);
        continue;
      }
      const legacyReady = await prisma.partNumber.count({
        where: { equipmentId: eq.id, publishStatus: "READY" },
      });
      const relationReady = await prisma.partNumber.count({
        where: {
          equipmentRelations: { some: { equipmentModelId: eq.id } },
          publishStatus: "READY",
        },
      });
      const legacyAll = await prisma.partNumber.count({ where: { equipmentId: eq.id } });
      console.log(`${model}(id=${eq.id}): legacyAll=${legacyAll} legacyReady=${legacyReady} relationReady=${relationReady}`);
    }

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
