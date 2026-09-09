import { prisma } from "./db";

/**
 * RFQ 智能匹配：根据询价单的件号/品牌/设备型号，找到合适的供应商
 * 用于询价大厅和供应商通知
 */
export async function matchSuppliersForRFQ(rfqId: number) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
    include: { partNumber: { include: { products: { include: { supplier: true } } } } },
  });

  if (!rfq) return [];

  // 1. 精确匹配：通过 partNumberId 找有该件号产品的供应商
  if (rfq.partNumberId) {
    const suppliers = await prisma.supplier.findMany({
      where: {
        products: {
          some: {
            partNumberId: rfq.partNumberId,
            status: "ACTIVE",
          },
        },
      },
      include: {
        products: {
          where: { partNumberId: rfq.partNumberId, status: "ACTIVE" },
          include: { partNumber: true },
        },
      },
    });
    return suppliers;
  }

  // 2. 模糊匹配：品牌 + 设备型号 + 关键词
  const orConditions: any[] = [];
  if (rfq.brandName) {
    orConditions.push({ mainProducts: { contains: rfq.brandName } });
  }
  if (rfq.partNumberStr) {
    orConditions.push({
      products: { some: { oemNumber: { contains: rfq.partNumberStr } } },
    });
  }

  if (orConditions.length > 0) {
    return prisma.supplier.findMany({
      where: { OR: orConditions },
      take: 20,
    });
  }

  // 3. 默认返回所有认证供应商
  return prisma.supplier.findMany({
    where: { verifiedStatus: "VERIFIED" },
    take: 20,
  });
}

/** 计算件号的替代件/OEM 互换关系 */
export async function findAlternativePartNumbers(partNumberId: number) {
  const products = await prisma.product.findMany({
    where: { partNumberId },
    select: { oemNumber: true },
  });
  const oemNumbers = products.map((p) => p.oemNumber).filter(Boolean) as string[];

  if (oemNumbers.length === 0) return [];

  return prisma.partNumber.findMany({
    where: {
      OR: [
        { number: { in: oemNumbers } },
        { products: { some: { oemNumber: { in: oemNumbers } } } },
      ],
      NOT: { id: partNumberId },
    },
    take: 10,
  });
}
