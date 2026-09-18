/**
 * ============================================================
 * V3.1 Stage 3.0 只读检查（migration reconciliation 方案前置）
 * 只读：
 *   - _prisma_migrations 表（哪些 migration 被 Prisma 记录为已应用）
 *   - Equipment id=2 真实 brand（修 [object Object]）
 *   - existing PartNumber 总数
 *   - Stage 1 新列/新表是否在生产库真实存在
 * 不写任何业务数据
 * ============================================================
 */
async function main() {
  console.log(`\n=== V3.1 Stage 3.0 只读检查 ===\n`);
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    // 1) _prisma_migrations 表（原生只读 SQL）
    let migrationsTable: any[] = [];
    try {
      migrationsTable = await prisma.$queryRawUnsafe<any[]>(
        `SELECT migration_name, finished_at, rolled_back_at, applied_steps_count FROM "_prisma_migrations" ORDER BY started_at`
      );
      console.log(`--- _prisma_migrations 表（生产已记录的 migration）---`);
      console.log(`记录数: ${migrationsTable.length}`);
      for (const m of migrationsTable) console.log(`  - ${m.migration_name}  finished_at=${m.finished_at}  steps=${m.applied_steps_count}`);
      if (migrationsTable.length === 0) console.log(`  （空：生产从未跑过 prisma migrate deploy，全部由 db push 管理）`);
    } catch (e: any) {
      console.log(`_prisma_migrations 表不存在或不可读: ${(e.message || "").split("\n")[0]}`);
    }

    // 2) Equipment id=2 真实字段
    console.log(`\n--- Equipment id=2（LS190 候选）---`);
    const eq2: any = await prisma.equipment.findUnique({ where: { id: 2 }, select: { id: true, brand: true, model: true, name: true, equipmentType: true, series: true } });
    if (eq2) {
      console.log(`equipment_id = ${eq2.id}`);
      console.log(`model       = ${eq2.model}`);
      console.log(`brand(字段)  = ${String(eq2.brand)}`);
      console.log(`name        = ${String(eq2.name)}`);
      console.log(`series      = ${String(eq2.series)}`);
      console.log(`type        = ${String(eq2.equipmentType)}`);
    } else {
      console.log(`Equipment id=2 不存在`);
    }

    // 3) existing PartNumber 总数
    const pnCount = await prisma.partNumber.count();
    console.log(`\nexisting PartNumber 总数 = ${pnCount}`);

    // 4) Stage 1 新列/新表只读确认
    const checks: Record<string, string> = {};
    try { await prisma.partNumber.findFirst({ select: { normalizedPartNumber: true } }); checks.normalizedPartNumber = "YES"; } catch { checks.normalizedPartNumber = "NO"; }
    try { await prisma.partNumberEquipment.count(); checks.PartNumberEquipment = "YES"; } catch { checks.PartNumberEquipment = "NO"; }
    try { await prisma.partNumberAuditLog.count(); checks.PartNumberAuditLog = "YES"; } catch { checks.PartNumberAuditLog = "NO"; }
    console.log(`\n--- Stage 1 Schema 在生产库 ---`);
    console.log(`normalizedPartNumber 列 = ${checks.normalizedPartNumber}`);
    console.log(`PartNumberEquipment 表 = ${checks.PartNumberEquipment}`);
    console.log(`PartNumberAuditLog 表 = ${checks.PartNumberAuditLog}`);

    await prisma.$disconnect();
  } catch (e: any) {
    console.log(`[警告] DB 不可用: ${(e.message || "").split("\n")[0]}`);
  }
  console.log(`\n=== Stage 3.0 只读检查完成 ===\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
export {};
