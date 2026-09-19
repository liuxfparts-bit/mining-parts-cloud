/**
 * ============================================================
 * V3.1 Stage 3.5A — ED10 / LS190 Equipment Identity & Count Audit
 * 100% READ-ONLY. 禁止任何写操作。
 *
 * 审计内容：
 *   1. Equipment LS190 / ED10 实体状态
 *   2. PartNumberEquipment 实际关系统计（ED10-only / LS190-only / BOTH）
 *   3. 区分 ALL 与 publishStatus=READY
 *   4. 样本 PN 列表
 *   5. 特定 PN 设备关系（016-15015 / 016-63028 / 106-03455 / 4697280）
 *   6. legacy PartNumber.equipmentId 统计
 * ============================================================
 */
async function main() {
  console.log(`\n=== Stage 3.5A ED10 / LS190 Equipment Identity & Count Audit (READ-ONLY) ===\n`);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // ===== 1. Equipment 实体审计 =====
    console.log(`--- [1] Equipment 实体 ---`);
    const ls190 = await prisma.equipment.findFirst({
      where: { model: "LS190" },
      select: { id: true, model: true, name: true, nameEn: true, brandId: true, equipmentType: true, manufacturer: true, series: true, slug: true, status: true, createdAt: true, updatedAt: true },
    });
    const ed10 = await prisma.equipment.findFirst({
      where: { model: "ED10" },
      select: { id: true, model: true, name: true, nameEn: true, brandId: true, equipmentType: true, manufacturer: true, series: true, slug: true, status: true, createdAt: true, updatedAt: true },
    });

    if (ls190) {
      console.log(`LS190_EQUIPMENT_FOUND = YES`);
      console.log(`LS190_ID = ${ls190.id}`);
      console.log(`LS190_MODEL = ${ls190.model}`);
      console.log(`LS190_NAME = ${ls190.name}`);
      console.log(`LS190_NAME_EN = ${ls190.nameEn || "(null)"}`);
      console.log(`LS190_BRAND_ID = ${ls190.brandId}`);
      console.log(`LS190_TYPE = ${ls190.equipmentType}`);
      console.log(`LS190_SLUG = ${ls190.slug}`);
      console.log(`LS190_STATUS = ${ls190.status}`);
      console.log(`LS190_MANUFACTURER = ${ls190.manufacturer || "(null)"}`);
    } else {
      console.log(`LS190_EQUIPMENT_FOUND = NO`);
    }
    console.log(``);
    if (ed10) {
      console.log(`ED10_EQUIPMENT_FOUND = YES`);
      console.log(`ED10_ID = ${ed10.id}`);
      console.log(`ED10_MODEL = ${ed10.model}`);
      console.log(`ED10_NAME = ${ed10.name}`);
      console.log(`ED10_NAME_EN = ${ed10.nameEn || "(null)"}`);
      console.log(`ED10_BRAND_ID = ${ed10.brandId}`);
      console.log(`ED10_TYPE = ${ed10.equipmentType}`);
      console.log(`ED10_SLUG = ${ed10.slug}`);
      console.log(`ED10_STATUS = ${ed10.status}`);
      console.log(`ED10_MANUFACTURER = ${ed10.manufacturer || "(null)"}`);
    } else {
      console.log(`ED10_EQUIPMENT_FOUND = NO`);
    }

    if (!ls190 || !ed10) {
      console.log(`\n⚠️  LS190 或 ED10 不存在，无法继续关系审计。`);
      await prisma.$disconnect();
      return;
    }

    const ls190Id = ls190.id;
    const ed10Id = ed10.id;

    // ===== 2. PartNumberEquipment 关系审计（ALL）=====
    console.log(`\n--- [2] PartNumberEquipment 关系统计（ALL PartNumber）---`);

    // 所有关联 ED10 的 distinct PN id
    const ed10RelAll = await prisma.partNumberEquipment.findMany({
      where: { equipmentModelId: ed10Id },
      select: { partNumberId: true },
      distinct: ["partNumberId"],
    });
    const ls190RelAll = await prisma.partNumberEquipment.findMany({
      where: { equipmentModelId: ls190Id },
      select: { partNumberId: true },
      distinct: ["partNumberId"],
    });

    const ed10PnIdsAll = new Set(ed10RelAll.map((r) => r.partNumberId));
    const ls190PnIdsAll = new Set(ls190RelAll.map((r) => r.partNumberId));

    const ed10ArrAll = Array.from(ed10PnIdsAll);
    const ls190ArrAll = Array.from(ls190PnIdsAll);
    const bothAll = ed10ArrAll.filter((id) => ls190PnIdsAll.has(id));
    const ed10OnlyAll = ed10ArrAll.filter((id) => !ls190PnIdsAll.has(id));
    const ls190OnlyAll = ls190ArrAll.filter((id) => !ed10PnIdsAll.has(id));
    const unionAll = new Set(ed10ArrAll.concat(ls190ArrAll));

    console.log(`ED10_ALL_PN_COUNT = ${ed10PnIdsAll.size}`);
    console.log(`LS190_ALL_PN_COUNT = ${ls190PnIdsAll.size}`);
    console.log(`ED10_ONLY_COUNT = ${ed10OnlyAll.length}`);
    console.log(`LS190_ONLY_COUNT = ${ls190OnlyAll.length}`);
    console.log(`ED10_AND_LS190_COUNT = ${bothAll.length}`);
    console.log(`UNION_DISTINCT_COUNT = ${unionAll.size}`);
    const setAssertionAll = unionAll.size === ed10OnlyAll.length + ls190OnlyAll.length + bothAll.length;
    console.log(`EQUIPMENT_RELATION_SET_ASSERTION = ${setAssertionAll ? "PASS" : "FAIL"}`);

    // ===== 3. PartNumberEquipment 关系审计（READY only）=====
    console.log(`\n--- [3] PartNumberEquipment 关系统计（publishStatus=READY only）---`);

    const allRelatedPnIds = Array.from(unionAll);
    const readyPns = await prisma.partNumber.findMany({
      where: { id: { in: allRelatedPnIds }, publishStatus: "READY" },
      select: { id: true, number: true },
    });
    const readyPnIds = new Set(readyPns.map((p) => p.id));

    const ed10OnlyReady = ed10OnlyAll.filter((id) => readyPnIds.has(id));
    const ls190OnlyReady = ls190OnlyAll.filter((id) => readyPnIds.has(id));
    const bothReady = bothAll.filter((id) => readyPnIds.has(id));
    const unionReady = new Set(ed10OnlyReady.concat(ls190OnlyReady).concat(bothReady));

    console.log(`ED10_READY_PN_COUNT = ${ed10OnlyReady.length + bothReady.length}`);
    console.log(`LS190_READY_PN_COUNT = ${ls190OnlyReady.length + bothReady.length}`);
    console.log(`ED10_ONLY_READY_COUNT = ${ed10OnlyReady.length}`);
    console.log(`LS190_ONLY_READY_COUNT = ${ls190OnlyReady.length}`);
    console.log(`ED10_AND_LS190_READY_COUNT = ${bothReady.length}`);
    console.log(`UNION_READY_DISTINCT_COUNT = ${unionReady.size}`);

    // ===== 4. 样本 PN（前20个，按 number asc）=====
    console.log(`\n--- [4] 样本 PN（前20，按 number asc）---`);

    const getPnNumbers = async (ids: number[]): Promise<string[]> => {
      if (ids.length === 0) return [];
      const pns = await prisma.partNumber.findMany({
        where: { id: { in: ids } },
        select: { number: true },
        orderBy: { number: "asc" },
        take: 20,
      });
      return pns.map((p) => p.number);
    }

    console.log(`ED10_ONLY_SAMPLE = ${(await getPnNumbers(ed10OnlyAll)).join(", ")}`);
    console.log(`LS190_ONLY_SAMPLE = ${(await getPnNumbers(ls190OnlyAll)).join(", ")}`);
    console.log(`ED10_AND_LS190_SAMPLE = ${(await getPnNumbers(bothAll)).join(", ")}`);

    // ===== 5. 特定 PN 设备关系 =====
    console.log(`\n--- [5] 特定 PN 设备关系 ---`);
    const targetNumbers = ["016-15015", "016-63028", "106-03455", "4697280"];
    for (const num of targetNumbers) {
      const pn = await prisma.partNumber.findFirst({
        where: { number: num },
        select: {
          id: true, number: true, publishStatus: true,
          equipmentRelations: { select: { equipmentModel: { select: { model: true } } } },
        },
      });
      if (pn) {
        const models = pn.equipmentRelations.map((r) => r.equipmentModel.model).join("+");
        console.log(`PN_${num.replace(/-/g, "_").replace(/\./g, "_")}_EQUIPMENT = ${models || "(无关系)"} (id=${pn.id}, publishStatus=${pn.publishStatus})`);
      } else {
        console.log(`PN_${num.replace(/-/g, "_").replace(/\./g, "_")}_EQUIPMENT = NOT_FOUND`);
      }
    }

    // ===== 6. legacy PartNumber.equipmentId 统计 =====
    console.log(`\n--- [6] legacy PartNumber.equipmentId 统计 ---`);
    const ls190Legacy = await prisma.partNumber.count({ where: { equipmentId: ls190Id } });
    const ed10Legacy = await prisma.partNumber.count({ where: { equipmentId: ed10Id } });
    const totalLegacy = await prisma.partNumber.count({ where: { equipmentId: { not: null } } });

    console.log(`LS190_LEGACY_EQUIPMENT_ID_COUNT = ${ls190Legacy}`);
    console.log(`ED10_LEGACY_EQUIPMENT_ID_COUNT = ${ed10Legacy}`);
    console.log(`TOTAL_PN_WITH_LEGACY_EQUIPMENT_ID = ${totalLegacy}`);

    // legacy LS190 的 PN 样本
    const ls190LegacyPns = await prisma.partNumber.findMany({
      where: { equipmentId: ls190Id },
      select: { number: true, publishStatus: true },
      orderBy: { number: "asc" },
      take: 20,
    });
    console.log(`LS190_LEGACY_PN_SAMPLE = ${ls190LegacyPns.map((p) => `${p.number}(${p.publishStatus})`).join(", ")}`);

    // ===== 7. PartNumber 总数 =====
    console.log(`\n--- [7] PartNumber 总数 ---`);
    const totalPn = await prisma.partNumber.count();
    const readyPn = await prisma.partNumber.count({ where: { publishStatus: "READY" } });
    console.log(`TOTAL_PART_NUMBER_COUNT = ${totalPn}`);
    console.log(`READY_PART_NUMBER_COUNT = ${readyPn}`);

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
