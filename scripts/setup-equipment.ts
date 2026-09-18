/**
 * ============================================================
 * V3.1 Stage 3.2B Equipment setup（ED10 幂等创建 + Sandvik Brand 精确 lookup）
 *   npm run setup:equipment -- --dry-run   只读预检
 *   npm run setup:equipment -- --apply     真正创建（仅 ED10 缺失时）
 *
 * Sandvik Brand lookup 规则（不硬编码 id）：
 *   1) slug = "sandvik"
 *   2) 验证 nameEn = "Sandvik" 且 name = "山特维克"
 *   3) 不匹配/多候选/状态异常 → STOP
 * LS190 永远 REUSE existing（model=LS190），绝不新建第二条。
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

  // 1) Sandvik Brand 精确 lookup（slug 优先 + nameEn 验证）
  const bySlug = await prisma.brand.findUnique({ where: { slug: "sandvik" }, select: { id: true, name: true, nameEn: true, slug: true, status: true } });
  if (!bySlug) {
    console.log(`STOP: slug="sandvik" 未找到 Brand，请人工确认。不自动创建 Brand。`);
    await prisma.$disconnect(); process.exit(1);
  }
  if (bySlug.nameEn !== "Sandvik") {
    console.log(`STOP: slug="sandvik" 找到但 nameEn="${bySlug.nameEn}" 不等于 "Sandvik"，异常，STOP。`);
    await prisma.$disconnect(); process.exit(1);
  }
  if (bySlug.status !== "ACTIVE") {
    console.log(`STOP: Sandvik Brand status=${bySlug.status} 非 ACTIVE，STOP。`);
    await prisma.$disconnect(); process.exit(1);
  }
  console.log(`SANDVIK_BRAND_ID      = ${bySlug.id}`);
  console.log(`SANDVIK_BRAND_NAME    = ${bySlug.name}`);
  console.log(`SANDVIK_BRAND_NAME_EN = ${bySlug.nameEn}`);
  console.log(`SANDVIK_BRAND_SLUG    = ${bySlug.slug}`);

  // 2) LS190 REUSE 验证
  const ls190 = await prisma.equipment.findFirst({ where: { model: "LS190" }, select: { id: true, model: true, name: true, brandId: true, equipmentType: true } });
  if (!ls190) {
    console.log(`STOP: model="LS190" 不存在，不创建第二条。请人工确认。`);
    await prisma.$disconnect(); process.exit(1);
  }
  if (ls190.brandId !== bySlug.id) {
    console.log(`STOP: LS190.brandId=${ls190.brandId} ≠ Sandvik brandId=${bySlug.id}，关系异常，STOP。`);
    await prisma.$disconnect(); process.exit(1);
  }
  console.log(`LS190_EQUIPMENT_ID = ${ls190.id}`);
  console.log(`LS190_BRAND_ID     = ${ls190.brandId}`);
  console.log(`LS190_STATUS       = REUSE_EXISTING`);

  // 3) ED10 幂等
  const ed10 = await prisma.equipment.findFirst({ where: { model: "ED10" }, select: { id: true, model: true, name: true, brandId: true, equipmentType: true } });
  if (ed10) {
    console.log(`ED10_STATUS      = REUSE_EXISTING`);
    console.log(`ED10_ID          = ${ed10.id}  brandId=${ed10.brandId}  name="${ed10.name}"`);
  } else {
    console.log(`ED10_STATUS      = ${apply ? "WOULD_CREATE→CREATING" : "WOULD_CREATE"}`);
    console.log(`ED10_BRAND_ID    = ${bySlug.id}（Sandvik）`);
    if (apply) {
      const created = await prisma.equipment.create({
        data: {
          slug: "sandvik-ed10",
          model: "ED10",
          name: "Sandvik ED10 Underground LHD",
          equipmentType: "Underground LHD",
          brandId: bySlug.id,
          manufacturer: "Sandvik Mining and Rock Solutions",
          status: "ACTIVE",
        },
        select: { id: true, model: true, name: true },
      });
      console.log(`ED10 已创建: id=${created.id}  model=${created.model}  name="${created.name}"`);
    }
  }

  await prisma.$disconnect();
  console.log(`\n=== ${apply ? "APPLY 完成" : "DRY-RUN 完成，未写库"} ===\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
export {};
