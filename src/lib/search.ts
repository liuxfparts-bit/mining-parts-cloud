import { prisma } from "./db";
import { normalizePartNumber, PUBLIC_PN_WHERE } from "./part-number";

/**
 * 全局搜索：件号 / 设备型号 / 品牌 / 供应商 / 产品名
 * P2-1B-1: Part Number 搜索同时使用原始件号与 normalizedPartNumber，
 * 并统一执行公开门槛 VERIFIED + READY。
 */
export async function searchAll(q: string) {
  const keyword = q.trim();
  if (!keyword) return { partNumbers: [], equipment: [], brands: [], suppliers: [] };
  const normalized = normalizePartNumber(keyword);

  const [partNumbers, equipment, brands, suppliers] = await Promise.all([
    prisma.partNumber.findMany({
      where: {
        ...PUBLIC_PN_WHERE,
        OR: [
          { number: { contains: keyword } },
          ...(normalized ? [{ normalizedPartNumber: { contains: normalized } }] : []),
          { name: { contains: keyword } },
          { nameEn: { contains: keyword } },
          { category: { contains: keyword } },
          { brand: { name: { contains: keyword } } },
          { brand: { nameEn: { contains: keyword } } },
          { equipmentRelations: { some: { equipmentModel: { model: { contains: keyword } } } } },
          { equipmentRelations: { some: { equipmentModel: { name: { contains: keyword } } } } },
        ],
      },
      include: { brand: true, equipmentRelations: { include: { equipmentModel: { include: { brand: true } } } }, products: { include: { supplier: true } } },
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
      include: { brand: true, _count: { select: { partNumberRelations: true } } },
      take: 10,
    }),
    prisma.brand.findMany({
      where: { OR: [{ name: { contains: keyword } }, { nameEn: { contains: keyword } }] },
      take: 5,
    }),
    prisma.supplier.findMany({
      where: {
        verifiedStatus: "VERIFIED",
        users: { none: { status: "DISABLED" } },
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

/**
 * 按件号搜索（核心搜索路径）。
 * 优先级：原始件号 exact → normalized exact → partial。
 */
export async function searchByPartNumber(q: string) {
  const keyword = q.trim();
  if (!keyword) return [];
  const normalized = normalizePartNumber(keyword);

  const items = await prisma.partNumber.findMany({
    where: {
      ...PUBLIC_PN_WHERE,
      OR: [
        { number: { contains: keyword } },
        ...(normalized ? [{ normalizedPartNumber: { contains: normalized } }] : []),
      ],
    },
    include: { brand: true, equipmentRelations: { include: { equipmentModel: { include: { brand: true } } } }, products: { include: { supplier: true } } },
    take: 20,
  });

  const upper = keyword.toUpperCase();
  return items.sort((a, b) => {
    const score = (item: typeof a) => {
      if (item.number.toUpperCase() === upper) return 0;
      if (normalized && item.normalizedPartNumber === normalized) return 1;
      return 2;
    };
    return score(a) - score(b) || a.number.localeCompare(b.number);
  });
}
