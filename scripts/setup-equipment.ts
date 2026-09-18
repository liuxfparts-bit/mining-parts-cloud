/**
 * ============================================================
 * V3.1 Stage 3.2 Equipment setup（ED10 幂等创建）
 *   npm run setup:equipment -- --dry-run   只读预检
 *   npm run setup:equipment -- --apply     真正创建（仅 ED10 缺失时）
 * 只读/写库都幂等：model=ED10 存在则 REUSE，不存在才 CREATE。
 * LS190 永远 REUSE existing(id=2)，绝不新建第二条。
 * ============================================================
 */
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");

async function main() {
  console.log(`\n=== V3.1 Equipment Setup（${apply ? "APPLY 写库" : "DRY-RUN 只读"}）===\n`);
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  // 1) 找 Sandvik Brand（只读）
  const brand = await prisma.brand.findFirst({ where: { name: { equals: "Sandvik", mode: "insensitive" } }, select: { id: true, name: true, nameEn: true } });
  console.log(`[Brand] Sandvik 匹配: ${brand ? `id=${brand.id} name="${brand.name}"` : "未找到（需人工处理，不自动建 Brand）"}`);
  if (!brand) {
    console.log("⚠️ 生产 Brand 表无 Sandvik，停止。请人工确认 Sandvik brand_id。");
    await prisma.$disconnect();
    process.exit(1);
  }

  // 2) LS190 现状（只读，REUSE）
  const ls190 = await prisma.equipment.findFirst({ where: { model: "LS190" }, select: { id: true, model: true, name: true, brandId: true } });
  console.log(`[Equipment] LS190: ${ls190 ? `REUSE id=${ls190.id} brandId=${ls190.brandId} name="${ls190.name}"` : "⚠️ 未找到 LS190（异常，CSV 已确认 equipment_id=2）"}`);

  // 3) ED10 幂等检查
  const ed10 = await prisma.equipment.findFirst({ where: { model: "ED10" }, select: { id: true, model: true, name: true } });
  if (ed10) {
    console.log(`[Equipment] ED10: REUSE id=${ed10.id}（已存在，不新建）`);
  } else {
    console.log(`[Equipment] ED10: ${apply ? "将创建" : "DRY-RUN：将创建"} brandId=${brand.id} type="Underground LHD" model="ED10" name="Sandvik ED10 Underground LHD"`);
    if (apply) {
      const created = await prisma.equipment.create({
        data: {
          model: "ED10",
          name: "Sandvik ED10 Underground LHD",
          equipmentType: "Underground LHD",
          brandId: brand.id,
          status: "ACTIVE",
        } as any,
        select: { id: true, model: true, name: true },
      });
      console.log(`[Equipment] ED10 已创建: id=${created.id}`);
    }
  }

  await prisma.$disconnect();
  console.log(`\n=== ${apply ? "APPLY 完成" : "DRY-RUN 完成，未写库"} ===\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
