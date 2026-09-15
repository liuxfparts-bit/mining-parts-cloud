// 历史数据迁移：为每条已有 RFQ 生成第一条 RFQItem（seq=1），并补齐 rfqNo 编号
// 执行：docker compose exec app node prisma/migrate-rfq-items.mjs
// 安全：只新增，不删除、不覆盖任何历史 RFQ / Quote 数据
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const beforeRfq = await prisma.rFQ.count();
  const beforeQuote = await prisma.quote.count();
  const beforeItem = await prisma.rFQItem.count();

  const rfqs = await prisma.rFQ.findMany({
    orderBy: { id: "asc" },
    include: { items: true },
  });

  let createdItems = 0;
  let filledNo = 0;

  for (const r of rfqs) {
    // 1) 已有 items 的跳过（幂等）
    if (r.items.length === 0) {
      await prisma.rFQItem.create({
        data: {
          rfqId: r.id,
          seq: 1,
          brandId: r.brandId,
          partNumberId: r.partNumberId,
          brandName: r.brandName,
          equipmentModel: r.equipmentModel,
          productName: r.productName,
          partNumberStr: r.partNumberStr,
          quantity: r.quantity,
          unit: r.unit,
          description: r.description,
          images: r.images,
        },
      });
      createdItems++;
    }

    // 2) 补齐 rfqNo（幂等）
    if (!r.rfqNo) {
      const d = r.createdAt;
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      const no = `RFQ-${ymd}-${String(r.id).padStart(3, "0")}`;
      await prisma.rFQ.update({ where: { id: r.id }, data: { rfqNo: no } });
      filledNo++;
    }
  }

  const afterRfq = await prisma.rFQ.count();
  const afterQuote = await prisma.quote.count();
  const afterItem = await prisma.rFQItem.count();

  console.log("========== RFQ 历史数据迁移完成 ==========");
  console.log(`RFQ: ${beforeRfq} -> ${afterRfq} (不得减少)`);
  console.log(`Quote: ${beforeQuote} -> ${afterQuote} (不得减少)`);
  console.log(`RFQItem: ${beforeItem} -> ${afterItem} (新增 ${createdItems})`);
  console.log(`rfqNo 补齐: ${filledNo} 条`);
  console.log("===========================================");

  if (afterRfq < beforeRfq || afterQuote < beforeQuote) {
    console.error("!! 数据减少，请立即停止并检查备份 !!");
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("迁移失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
