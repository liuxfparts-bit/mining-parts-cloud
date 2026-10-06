import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSupplierWriteAccess } from "@/lib/supplier-write-access";
import { splitStoredUploadUrls, uploadPrincipal, uploadUrlsBelongToPrincipal } from "@/lib/upload-policy";

export async function POST(req: Request) {
  const access = await resolveSupplierWriteAccess("BUSINESS");
  if (!access.ok) return NextResponse.json({ success: false, message: access.message, code: access.code }, { status: access.status });
  const supplierId = access.supplierId;

  const b = await req.json();
  const imageUrls = splitStoredUploadUrls(b.images);
  const principal = uploadPrincipal("SUPPLIER", supplierId);
  if (!uploadUrlsBelongToPrincipal(imageUrls, "product-image", principal)) {
    return NextResponse.json({ success: false, message: "产品图片不属于当前供应商或上传用途无效" }, { status: 400 });
  }
  const partNumberId = parseInt(b.partNumberId);
  if (!partNumberId) return NextResponse.json({ success: false, message: "未选件号" }, { status: 400 });

  const dup = await prisma.product.findFirst({ where: { supplierId: supplierId, partNumberId } });
  if (dup) return NextResponse.json({ success: false, message: "您已为该件号发布产品" }, { status: 409 });

  await prisma.product.create({
    data: {
      name: b.name || "",
      partNumberId,
      supplierId,
      productType: b.productType || "Aftermarket",
      price: b.price,
      currency: b.currency || "CNY",
      moq: b.moq || 1,
      stockStatus: b.stockStatus || "IN_STOCK",
      stock: b.stock,
      leadTime: b.leadTime,
      warranty: b.warranty,
      description: b.description,
      images: imageUrls.join(","),
      status: b.status === "DRAFT" ? "DRAFT" : "PENDING",
      verificationStatus: b.status === "DRAFT" ? "UNVERIFIED" : "PENDING",
    },
  });
  return NextResponse.json({ success: true });
}
