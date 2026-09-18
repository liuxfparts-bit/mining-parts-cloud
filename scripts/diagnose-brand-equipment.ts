/**
 * ============================================================
 * V3.1 Stage 3.2A Brand / Equipment 只读诊断
 * 100% READ-ONLY：findMany/findFirst/count/include relation
 * 禁止 create/update/delete/upsert/executeRaw写
 * ============================================================
 */
async function main() {
  console.log(`\n=== V3.1 Stage 3.2A Brand/Equipment 只读诊断 ===\n`);
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  // 1) Brand 表全部记录
  const brands = await prisma.brand.findMany({
    select: { id: true, slug: true, name: true, nameEn: true, country: true, status: true },
    orderBy: { id: "asc" },
  });
  console.log(`--- Brand 表（BRAND_COUNT=${brands.length}）---`);
  for (const b of brands) {
    console.log(`  id=${b.id}  name="${b.name}"  nameEn="${b.nameEn}"  slug="${b.slug}"  country="${b.country}"  status=${b.status}`);
  }

  // 2) Equipment id=2 + model=LS190，include Brand
  console.log(`\n--- Equipment id=2 ---`);
  const eq2 = await prisma.equipment.findUnique({
    where: { id: 2 },
    select: { id: true, model: true, name: true, equipmentType: true, brandId: true, status: true, manufacturer: true, brand: { select: { id: true, name: true, nameEn: true } } },
  });
  if (eq2) {
    console.log(`  id=${eq2.id}  model="${eq2.model}"  name="${eq2.name}"  type="${eq2.equipmentType}"`);
    console.log(`  brandId=${eq2.brandId}  manufacturer="${eq2.manufacturer}"`);
    console.log(`  LS190_BRAND_ID = ${eq2.brandId}`);
    console.log(`  LS190_BRAND_RELATION = ${eq2.brand ? `id=${eq2.brand.id} name="${eq2.brand.name}" nameEn="${eq2.brand.nameEn}"` : "孤儿引用/找不到 Brand"}`);
  } else {
    console.log(`  Equipment id=2 不存在`);
  }

  console.log(`\n--- Equipment model=LS190 ---`);
  const ls190 = await prisma.equipment.findFirst({
    where: { model: "LS190" },
    select: { id: true, model: true, name: true, brandId: true, brand: { select: { id: true, name: true, nameEn: true } } },
  });
  console.log(ls190 ? `  id=${ls190.id} model="${ls190.model}" name="${ls190.name}" brandId=${ls190.brandId} brand="${ls190.brand?.name}" nameEn="${ls190.brand?.nameEn}"` : `  model=LS190 不存在`);

  // 3) 所有 Sandvik 相关 Equipment
  console.log(`\n--- Equipment 含 Sandvik/LS190/ED10/MB670 关键字 ---`);
  const sandvikEqs = await prisma.equipment.findMany({
    where: {
      OR: [
        { model: { contains: "LS190" } },
        { model: { contains: "ED10" } },
        { model: { contains: "MB670" } },
        { name: { contains: "Sandvik" } },
        { name: { contains: "山特维克" } },
        { manufacturer: { contains: "Sandvik" } },
      ],
    },
    select: { id: true, model: true, name: true, brandId: true, brand: { select: { id: true, name: true, nameEn: true } } },
    orderBy: { id: "asc" },
  });
  for (const e of sandvikEqs) {
    console.log(`  id=${e.id}  model="${e.model}"  name="${e.name}"  brandId=${e.brandId}  brand.name="${e.brand?.name}"  nameEn="${e.brand?.nameEn}"`);
  }

  // 4) Brand 使用统计
  console.log(`\n--- Brand → Equipment 数量 ---`);
  const brandStats = await prisma.brand.findMany({
    select: { id: true, name: true, nameEn: true, _count: { select: { equipment: true } } },
    orderBy: { id: "asc" },
  });
  for (const s of brandStats) {
    console.log(`  brand_id=${s.id}  name="${s.name}"  nameEn="${s.nameEn}"  equipment_count=${s._count.equipment}`);
  }

  await prisma.$disconnect();
  console.log(`\n=== Stage 3.2A 只读诊断完成 ===\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
export {};
