import { prisma } from "./db";

/**
 * 全局搜索：件号 / 设备型号 / 品牌 / 供应商 / 产品名
 * 开发 SQLite：LIKE 模糊匹配
 * 生产 PostgreSQL：自动切换 to_tsvector 全文搜索
 */
export async function searchAll(q: string) {
  const keyword = q.trim();
  if (!keyword) return { partNumbers: [], equipment: [], brands: [], suppliers: [] };

  // SQLite LIKE 搜索
  const [partNumbers, equipment, brands, suppliers] = await Promise.all([
    prisma.partNumber.findMany({
      where: {
        OR: [
          { number: { contains: keyword } },
          { name: { contains: keyword } },
          { nameEn: { contains: keyword } },
          { category: { contains: keyword } },
        ],
      },
      include: { brand: true, equipment: { include: { brand: true } }, products: { include: { supplier: true } } },
      take: 15,
    }),
    prisma.equipment.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { model: { contains: keyword } },
          { name: { contains: keyword } },
          { equipmentType: { contains: keyword } },
          { brand: { name: { contains: keyword } } },
        ],
      },
      include: { brand: true, _count: { select: { partNumbers: true } } },
      take: 10,
    }),
    prisma.brand.findMany({
      where: { OR: [{ name: { contains: keyword } }, { nameEn: { contains: keyword } }] },
      take: 5,
    }),
    prisma.supplier.findMany({
      where: {
        OR: [
          { name: { contains: keyword } },
          { shortName: { contains: keyword } },
          { mainBusiness: { contains: keyword } },
          { province: { contains: keyword } },
        ],
      },
      take: 10,
    }),
  ]);

  return { partNumbers, equipment, brands, suppliers };
}

/** 按件号搜索（核心搜索路径） */
export async function searchByPartNumber(q: string) {
  return prisma.partNumber.findMany({
    where: { number: { contains: q.trim() } },
    include: { brand: true, equipment: { include: { brand: true } }, products: { include: { supplier: true } } },
    take: 20,
  });
}
