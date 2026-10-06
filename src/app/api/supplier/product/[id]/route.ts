import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { changedProductTrustFields } from "@/lib/product-verification";
import { resolveSupplierWriteAccess } from "@/lib/supplier-write-access";
import { splitStoredUploadUrls, uploadPrincipal, uploadUrlsBelongToPrincipal } from "@/lib/upload-policy";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const access = await resolveSupplierWriteAccess("BUSINESS");
  if (!access.ok) return NextResponse.json({ success: false, message: access.message, code: access.code }, { status: access.status });
  const supplierId = access.supplierId;

  const product = await prisma.product.findUnique({ where: { id: parseInt(params.id) } });
  if (!product) return NextResponse.json({ success: false, message: "不存在" }, { status: 404 });
  if (product.supplierId !== supplierId) {
    return NextResponse.json({ success: false, message: "无权" }, { status: 403 });
  }

  const b = await req.json();
  const imageUrls = splitStoredUploadUrls(b.images);
  const existingImageUrls = splitStoredUploadUrls(product.images);
  const principal = uploadPrincipal("SUPPLIER", supplierId);
  if (!uploadUrlsBelongToPrincipal(imageUrls, "product-image", principal, existingImageUrls)) {
    return NextResponse.json({ success: false, message: "产品图片不属于当前供应商或上传用途无效" }, { status: 400 });
  }
  const data: any = {
    name: b.name,
    productType: b.productType,
    price: b.price ? parseFloat(b.price) : null,
    currency: b.currency,
    moq: b.moq ? parseInt(b.moq) : 1,
    stockStatus: b.stockStatus,
    stock: b.stock ? parseInt(b.stock) : null,
    leadTime: b.leadTime,
    warranty: b.warranty,
    description: b.description,
    images: imageUrls.join(","),
  };

  const changedTrustFields = changedProductTrustFields(product as any, data);
  const invalidatesVerification =
    product.verificationStatus === "VERIFIED" && changedTrustFields.length > 0;

  if (b.action === "resubmit" || invalidatesVerification) {
    data.status = "PENDING";
    data.verificationStatus = "PENDING";
    data.verifiedAt = null;
    data.verifiedBy = null;
    data.verificationReason = invalidatesVerification
      ? "供应商修改可信字段，原验证自动失效，需重新审核"
      : null;
    data.rejectedAt = null;
    data.rejectedBy = null;
  }

  // Optimistic concurrency guard: an admin approval or another edit that lands
  // after this page was loaded must not be silently overwritten.
  const updatedCount = await prisma.$transaction(async (tx) => {
    const result = await tx.product.updateMany({
      where: { id: product.id, supplierId, updatedAt: product.updatedAt },
      data,
    });
    if (result.count === 1 && invalidatesVerification) {
      await tx.securityAuditLog.create({
        data: {
          actorUserId: access.userId,
          action: "PRODUCT_VERIFICATION_INVALIDATED",
          targetType: "PRODUCT",
          targetId: String(product.id),
          metadata: {
            reason: "SUPPLIER_TRUST_FIELD_EDIT",
            changedFields: changedTrustFields,
            fromStatus: product.status,
            fromVerificationStatus: product.verificationStatus,
            toStatus: "PENDING",
            toVerificationStatus: "PENDING",
          },
        },
      });
    }
    return result.count;
  });
  if (updatedCount !== 1) {
    return NextResponse.json(
      { success: false, message: "产品已被其他操作更新，请刷新后重试" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    verificationInvalidated: invalidatesVerification,
    changedTrustFields,
  });
}
