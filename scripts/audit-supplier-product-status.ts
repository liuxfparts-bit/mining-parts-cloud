/**
 * ============================================================
 * V3.1 Stage 3.5B-P0.2 — SupplierProduct Public Visibility & Status Semantics Audit
 * 100% READ-ONLY. 禁止任何写操作。
 *
 * 审计目标：
 *   1. Product.status 真实生产分布（不假设只有 ACTIVE/INACTIVE）
 *   2. 各 status 与 Supplier 审核状态交叉
 *   3. 各 status 与 PartNumber.publishStatus 交叉
 *   4. 160 个 READY PN 的供应信息覆盖（ACTIVE vs PUBLISHED 规则对比）
 *   5. ED10 / LS190 维度的供应商/产品统计
 *   6. 106-03455 具体供应信息
 * ============================================================
 */
async function main() {
  console.log(`\n=== Stage 3.5B-P0.2 SupplierProduct Status Audit (READ-ONLY) ===\n`);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // ============================================================
    // 1. Product.status 全量分布（枚举所有 distinct status）
    // ============================================================
    console.log(`--- [1] Product.status 全量分布 ---`);
    const totalProducts = await prisma.product.count();
    console.log(`TOTAL_SUPPLIER_PRODUCT_COUNT = ${totalProducts}`);

    const statusGroups = await prisma.product.groupBy({
      by: ["status"],
      _count: true,
      orderBy: { _count: { status: "desc" } },
    });
    console.log(`STATUS_DISTRIBUTION:`);
    const statusCounts: Record<string, number> = {};
    for (const g of statusGroups) {
      console.log(`  ${g.status} = ${g._count}`);
      statusCounts[g.status] = g._count;
    }
    const knownStatuses = ["ACTIVE", "PUBLISHED", "INACTIVE", "PENDING"];
    const otherStatuses = statusGroups.filter((g) => !knownStatuses.includes(g.status)).map((g) => g.status);
    console.log(`OTHER_STATUS_VALUES = ${otherStatuses.length > 0 ? otherStatuses.join(", ") : "(无)"}`);
    console.log(`STATUS_ACTIVE_COUNT = ${statusCounts["ACTIVE"] ?? 0}`);
    console.log(`STATUS_PUBLISHED_COUNT = ${statusCounts["PUBLISHED"] ?? 0}`);
    console.log(`STATUS_INACTIVE_COUNT = ${statusCounts["INACTIVE"] ?? 0}`);
    console.log(`STATUS_PENDING_COUNT = ${statusCounts["PENDING"] ?? 0}`);

    // ============================================================
    // 2. Product.status × Supplier.verifiedStatus 交叉
    // ============================================================
    console.log(`\n--- [2] Product.status × Supplier.verifiedStatus 交叉 ---`);
    const productsWithSupplier = await prisma.product.findMany({
      select: {
        status: true,
        supplier: { select: { verifiedStatus: true, users: { select: { status: true } } } },
      },
    });
    const crossSupplier: Record<string, Record<string, number>> = {};
    for (const p of productsWithSupplier) {
      const s = p.supplier;
      const supplierState =
        s.verifiedStatus === "VERIFIED"
          ? s.users.some((u) => u.status === "DISABLED")
            ? "VERIFIED_BUT_USER_DISABLED"
            : "VERIFIED"
          : s.verifiedStatus || "UNKNOWN";
      if (!crossSupplier[p.status]) crossSupplier[p.status] = {};
      crossSupplier[p.status][supplierState] = (crossSupplier[p.status][supplierState] || 0) + 1;
    }
    for (const [status, dist] of Object.entries(crossSupplier)) {
      console.log(`  status=${status}: ${JSON.stringify(dist)}`);
    }

    // ============================================================
    // 3. Product.status × PartNumber.publishStatus 交叉
    // ============================================================
    console.log(`\n--- [3] Product.status × PartNumber.publishStatus 交叉 ---`);
    const productsWithPN = await prisma.product.findMany({
      select: { status: true, partNumber: { select: { publishStatus: true, number: true } } },
    });
    const crossPN: Record<string, Record<string, number>> = {};
    for (const p of productsWithPN) {
      const pnStatus = p.partNumber?.publishStatus || "NO_PN";
      if (!crossPN[p.status]) crossPN[p.status] = {};
      crossPN[p.status][pnStatus] = (crossPN[p.status][pnStatus] || 0) + 1;
    }
    for (const [status, dist] of Object.entries(crossPN)) {
      console.log(`  status=${status}: ${JSON.stringify(dist)}`);
    }

    // ============================================================
    // 4. 160 个 READY PN 的供应信息覆盖
    // ============================================================
    console.log(`\n--- [4] READY PN 供应信息覆盖 ---`);
    const readyPNs = await prisma.partNumber.findMany({
      where: { publishStatus: "READY" },
      select: { id: true, number: true },
    });
    console.log(`READY_PN_COUNT = ${readyPNs.length}`);
    const readyPNIds = readyPNs.map((p) => p.id);

    const readyPNWithAnyProduct = await prisma.product.count({
      where: { partNumberId: { in: readyPNIds } },
    });
    console.log(`READY_PN_WITH_ANY_SUPPLIER_PRODUCT = ${readyPNWithAnyProduct}`);

    const readyPNWithActive = await prisma.product.count({
      where: { partNumberId: { in: readyPNIds }, status: "ACTIVE" },
    });
    console.log(`READY_PN_WITH_PUBLIC_PRODUCT_BY_ACTIVE = ${readyPNWithActive}`);

    const readyPNWithPublished = await prisma.product.count({
      where: { partNumberId: { in: readyPNIds }, status: "PUBLISHED" },
    });
    console.log(`READY_PN_WITH_PUBLIC_PRODUCT_BY_PUBLISHED = ${readyPNWithPublished}`);

    // distinct suppliers
    const activeProducts = await prisma.product.findMany({
      where: { partNumberId: { in: readyPNIds }, status: "ACTIVE" },
      select: { supplierId: true },
    });
    const publishedProducts = await prisma.product.findMany({
      where: { partNumberId: { in: readyPNIds }, status: "PUBLISHED" },
      select: { supplierId: true },
    });
    console.log(`DISTINCT_SUPPLIERS_BY_ACTIVE = ${new Set(activeProducts.map((p) => p.supplierId)).size}`);
    console.log(`DISTINCT_SUPPLIERS_BY_PUBLISHED = ${new Set(publishedProducts.map((p) => p.supplierId)).size}`);

    // ============================================================
    // 5. ED10 / LS190 维度
    // ============================================================
    console.log(`\n--- [5] ED10 / LS190 供应信息 ---`);
    for (const model of ["ED10", "LS190"]) {
      const eq = await prisma.equipment.findFirst({ where: { model }, select: { id: true } });
      if (!eq) {
        console.log(`${model}: NOT FOUND`);
        continue;
      }
      const readyPNInEquipment = await prisma.partNumber.findMany({
        where: {
          publishStatus: "READY",
          equipmentRelations: { some: { equipmentModelId: eq.id } },
        },
        select: { id: true },
      });
      const pnIds = readyPNInEquipment.map((p) => p.id);
      console.log(`${model}_READY_PN = ${pnIds.length}`);

      const activeCount = await prisma.product.count({ where: { partNumberId: { in: pnIds }, status: "ACTIVE" } });
      const publishedCount = await prisma.product.count({ where: { partNumberId: { in: pnIds }, status: "PUBLISHED" } });
      console.log(`${model}_PUBLIC_PRODUCTS_ACTIVE = ${activeCount}`);
      console.log(`${model}_PUBLIC_PRODUCTS_PUBLISHED = ${publishedCount}`);

      const activeProds = await prisma.product.findMany({ where: { partNumberId: { in: pnIds }, status: "ACTIVE" }, select: { supplierId: true } });
      const publishedProds = await prisma.product.findMany({ where: { partNumberId: { in: pnIds }, status: "PUBLISHED" }, select: { supplierId: true } });
      console.log(`${model}_DISTINCT_SUPPLIERS_ACTIVE = ${new Set(activeProds.map((p) => p.supplierId)).size}`);
      console.log(`${model}_DISTINCT_SUPPLIERS_PUBLISHED = ${new Set(publishedProds.map((p) => p.supplierId)).size}`);
    }

    // ============================================================
    // 6. 106-03455 具体供应信息
    // ============================================================
    console.log(`\n--- [6] 106-03455 供应信息 ---`);
    const pn106 = await prisma.partNumber.findFirst({ where: { number: "106-03455" }, select: { id: true, publishStatus: true } });
    if (pn106) {
      const prods106 = await prisma.product.findMany({
        where: { partNumberId: pn106.id },
        select: { id: true, status: true, supplierId: true, supplier: { select: { name: true, verifiedStatus: true } } },
      });
      console.log(`PN_106_03455_PRODUCT_COUNT = ${prods106.length}`);
      console.log(`PN_106_03455_PRODUCT_STATUS = ${prods106.length > 0 ? prods106.map((p) => p.status).join(",") : "(无)"}`);
      console.log(`PN_106_03455_DISTINCT_SUPPLIERS = ${new Set(prods106.map((p) => p.supplierId)).size}`);
      if (prods106.length === 0) {
        console.log(`ZERO_SUPPLIER_DISPLAY_CORRECT = YES（确实没有 SupplierProduct）`);
      } else {
        console.log(`ZERO_SUPPLIER_DISPLAY_CORRECT = NEEDS_REVIEW（有 ${prods106.length} 个 SupplierProduct 但页面显示0家）`);
        for (const p of prods106) {
          console.log(`  productId=${p.id} status=${p.status} supplier=${p.supplier.name} verified=${p.supplier.verifiedStatus}`);
        }
      }
    } else {
      console.log(`106-03455: NOT FOUND`);
    }

    // ============================================================
    // 7. 各 status 抽样（最多10条）
    // ============================================================
    console.log(`\n--- [7] 各 status 抽样（最多10条）---`);
    for (const status of Object.keys(statusCounts)) {
      const samples = await prisma.product.findMany({
        where: { status },
        take: 10,
        select: {
          id: true,
          partNumber: { select: { number: true, publishStatus: true } },
          supplierId: true,
          supplier: { select: { name: true, verifiedStatus: true } },
        },
        orderBy: { id: "asc" },
      });
      console.log(`\n  status=${status} (共${statusCounts[status]}条，抽样${samples.length}条):`);
      for (const s of samples) {
        console.log(`    productId=${s.id} PN=${s.partNumber?.number}(${s.partNumber?.publishStatus}) supplier=${s.supplier?.name}(${s.supplier?.verifiedStatus})`);
      }
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
