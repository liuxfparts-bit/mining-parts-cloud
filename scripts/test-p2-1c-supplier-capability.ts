import { prisma } from "../src/lib/prisma";
import { findTrustedSupplierIdsForPartNumber } from "../src/lib/supplier-capability";

const TARGET = "016-63028";
const NORMALIZED = "01663028";
const VERIFIED_SLUG = "__p2-1c-test-verified";
const PENDING_SLUG = "__p2-1c-test-pending";
const COLLISION_NUMBER = "__P2-1C-01663028";
const COLLISION_SLUG = "__p2-1c-collision-01663028";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

async function fixtureSupplierIds() {
  const suppliers = await prisma.supplier.findMany({
    where: { slug: { in: [VERIFIED_SLUG, PENDING_SLUG] } },
    select: { id: true },
  });
  return suppliers.map((supplier) => supplier.id);
}

async function fixturePartNumberIds() {
  const partNumbers = await prisma.partNumber.findMany({
    where: { OR: [{ number: COLLISION_NUMBER }, { slug: COLLISION_SLUG }] },
    select: { id: true },
  });
  return partNumbers.map((partNumber) => partNumber.id);
}

async function cleanupFixtures() {
  const supplierIds = await fixtureSupplierIds();
  const partNumberIds = await fixturePartNumberIds();

  const productOr: Array<Record<string, unknown>> = [];
  if (supplierIds.length) productOr.push({ supplierId: { in: supplierIds } });
  if (partNumberIds.length) productOr.push({ partNumberId: { in: partNumberIds } });

  if (productOr.length) {
    await prisma.product.deleteMany({ where: { OR: productOr } });
  }
  if (partNumberIds.length) {
    await prisma.partNumberEquipment.deleteMany({
      where: { partNumberId: { in: partNumberIds } },
    });
    await prisma.partNumber.deleteMany({ where: { id: { in: partNumberIds } } });
  }
  if (supplierIds.length) {
    await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
  }
}

async function main() {
  console.log("=== P2-1C SUPPLIER CAPABILITY TEST ===");
  await cleanupFixtures();

  const target = await prisma.partNumber.findUnique({ where: { number: TARGET } });
  assert(target, `${TARGET} must exist`);
  assert(target.verificationStatus === "VERIFIED", "target PN must be VERIFIED");
  assert(target.publishStatus === "READY", "target PN must be READY");
  assert(target.normalizedPartNumber === NORMALIZED, "target normalized PN mismatch");

  const baselineProducts = await prisma.product.count({ where: { partNumberId: target.id } });
  assert(baselineProducts === 0, "target PN must start with zero Products");

  console.log("TEST A: trusted PN with no Product -> no supplier capability");
  const a = await findTrustedSupplierIdsForPartNumber(TARGET);
  assert(a.partNumberId === target.id, "A must resolve target PN");
  assert(a.supplierIds.length === 0, "A must return zero suppliers");
  console.log("PASS A", a);

  const verifiedSupplier = await prisma.supplier.create({
    data: {
      slug: VERIFIED_SLUG,
      name: "__P2_1C_TEST_VERIFIED__",
      mainBusiness: "Temporary P2-1C test fixture",
      verifiedStatus: "VERIFIED",
      updatedAt: new Date(),
    },
  });
  const pendingSupplier = await prisma.supplier.create({
    data: {
      slug: PENDING_SLUG,
      name: "__P2_1C_TEST_PENDING__",
      mainBusiness: "Temporary P2-1C test fixture",
      verifiedStatus: "PENDING",
      updatedAt: new Date(),
    },
  });

  console.log("TEST B: VERIFIED Product + VERIFIED Supplier -> trusted match");
  await prisma.product.create({
    data: {
      partNumberId: target.id,
      supplierId: verifiedSupplier.id,
      name: "__P2_1C_TEST_VERIFIED_PRODUCT__",
      oemNumber: "__P2_1C_VERIFIED_PRODUCT__",
      verificationStatus: "VERIFIED",
      updatedAt: new Date(),
    },
  });
  const b = await findTrustedSupplierIdsForPartNumber(TARGET);
  assert(b.partNumberId === target.id, "B must resolve target PN");
  assert(b.supplierIds.length === 1 && b.supplierIds[0] === verifiedSupplier.id, "B must return only verified supplier");
  console.log("PASS B", b);

  console.log("TEST C: UNVERIFIED Product -> excluded");
  await prisma.product.create({
    data: {
      partNumberId: target.id,
      supplierId: pendingSupplier.id,
      name: "__P2_1C_TEST_UNVERIFIED_PRODUCT__",
      oemNumber: "__P2_1C_UNVERIFIED_PRODUCT__",
      verificationStatus: "UNVERIFIED",
      updatedAt: new Date(),
    },
  });
  const c = await findTrustedSupplierIdsForPartNumber(TARGET);
  assert(c.supplierIds.length === 1 && c.supplierIds[0] === verifiedSupplier.id, "C must exclude unverified Product");
  console.log("PASS C", c);

  console.log("TEST D: VERIFIED Product + PENDING Supplier -> excluded");
  await prisma.product.create({
    data: {
      partNumberId: target.id,
      supplierId: pendingSupplier.id,
      name: "__P2_1C_TEST_PENDING_SUPPLIER_PRODUCT__",
      oemNumber: "__P2_1C_PENDING_SUPPLIER__",
      verificationStatus: "VERIFIED",
      updatedAt: new Date(),
    },
  });
  const d = await findTrustedSupplierIdsForPartNumber(TARGET);
  assert(d.supplierIds.length === 1 && d.supplierIds[0] === verifiedSupplier.id, "D must exclude pending Supplier");
  console.log("PASS D", d);

  console.log("TEST E: unique normalized input -> trusted target");
  const e = await findTrustedSupplierIdsForPartNumber(NORMALIZED);
  assert(e.partNumberId === target.id, "E normalized input must resolve target PN");
  assert(e.supplierIds.length === 1 && e.supplierIds[0] === verifiedSupplier.id, "E must preserve trusted supplier");
  console.log("PASS E", e);

  console.log("TEST F: ambiguous normalized collision -> fail closed");
  await prisma.partNumber.create({
    data: {
      number: COLLISION_NUMBER,
      slug: COLLISION_SLUG,
      name: "__P2_1C_COLLISION__",
      normalizedPartNumber: NORMALIZED,
      verificationStatus: "VERIFIED",
      publishStatus: "READY",
      verified: true,
      updatedAt: new Date(),
    },
  });
  const f = await findTrustedSupplierIdsForPartNumber(NORMALIZED);
  assert(f.partNumberId === null, "F ambiguous normalized input must return null PN");
  assert(f.supplierIds.length === 0, "F ambiguous normalized input must return zero suppliers");
  console.log("PASS F", f);

  console.log("=== ALL P2-1C TESTS PASSED ===");
}

main()
  .catch((error) => {
    console.error("=== P2-1C TEST FAILED ===");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    console.log("=== CLEANUP ===");
    try {
      await cleanupFixtures();
      console.log("PASS: temporary fixtures removed");
    } catch (error) {
      console.error("CLEANUP FAILED", error);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  });
