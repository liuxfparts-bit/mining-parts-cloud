import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUserReadRfq, type RfqAccessUser } from "@/lib/rfq-supplier-access";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/public-product";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

type Reader = RfqAccessUser & { status: string };

async function activeReader(): Promise<Reader | null> {
  const session = await auth();
  const id = Number((session?.user as any)?.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, status: true, buyerCompanyId: true, supplierId: true },
  });
  return user?.status === "ACTIVE" ? user : null;
}

function principalId(value: string, prefix: string): number | null {
  const match = value.match(new RegExp(`^${prefix}-([1-9]\\d*)$`));
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}

async function canReadRfqUpload(url: string, reader: Reader | null, previewCompanyId?: number | null) {
  if (reader?.role === "ADMIN") return true;
  if (previewCompanyId && reader?.role === "BUYER" && reader.buyerCompanyId === previewCompanyId) return true;
  const item = await prisma.rFQItem.findFirst({
    where: { images: { contains: url } },
    select: { rfq: { select: { visibility: true, matchedSuppliers: true, userID: true, companyID: true, businessAuthenticity: true } } },
  });
  if (item) return canUserReadRfq(item.rfq, reader);
  const rfq = await prisma.rFQ.findFirst({
    where: { images: { contains: url } },
    select: { visibility: true, matchedSuppliers: true, userID: true, companyID: true, businessAuthenticity: true },
  });
  return !!rfq && canUserReadRfq(rfq, reader);
}

async function canReadQuoteUpload(url: string, reader: Reader | null, previewSupplierId?: number | null) {
  if (reader?.role === "ADMIN") return true;
  if (previewSupplierId && reader?.role === "SUPPLIER" && reader.supplierId === previewSupplierId) return true;
  const quote = await prisma.quote.findFirst({
    where: { attachments: { contains: url } },
    select: {
      supplierId: true,
      rfq: { select: { visibility: true, matchedSuppliers: true, userID: true, companyID: true, businessAuthenticity: true } },
    },
  });
  if (!quote) return false;
  if (reader?.role === "SUPPLIER") return reader.supplierId === quote.supplierId;
  return !!reader && canUserReadRfq(quote.rfq, reader);
}

async function canReadProductUpload(url: string, reader: Reader | null, previewSupplierId?: number | null) {
  if (reader?.role === "ADMIN") return true;
  if (previewSupplierId && reader?.role === "SUPPLIER" && reader.supplierId === previewSupplierId) return true;
  const publicProduct = await prisma.product.findFirst({
    where: { AND: [PUBLIC_PRODUCT_WHERE, { images: { contains: url } }] },
    select: { id: true },
  });
  if (publicProduct) return true;
  if (reader?.role === "SUPPLIER" && reader.supplierId) {
    const own = await prisma.product.findFirst({
      where: { supplierId: reader.supplierId, images: { contains: url } },
      select: { id: true },
    });
    return !!own;
  }
  return false;
}

async function canReadBuyerLicense(url: string, reader: Reader | null, previewUserId?: number | null) {
  if (reader?.role === "ADMIN") return true;
  if (previewUserId && reader?.id === previewUserId) return true;
  if (reader?.role !== "BUYER" || !reader.buyerCompanyId) return false;
  const company = await prisma.buyerCompany.findFirst({
    where: { id: reader.buyerCompanyId, licenseImage: url },
    select: { id: true },
  });
  return !!company;
}

async function canReadLegacyUpload(url: string, reader: Reader | null) {
  const publicAdminAsset = await Promise.all([
    prisma.banner.findFirst({ where: { imageUrl: url }, select: { id: true } }),
    prisma.brand.findFirst({ where: { logo: url }, select: { id: true } }),
    prisma.equipment.findFirst({ where: { imageUrl: url }, select: { id: true } }),
  ]);
  if (publicAdminAsset.some(Boolean)) return true;
  if (await canReadProductUpload(url, reader)) return true;
  if (await canReadRfqUpload(url, reader)) return true;
  if (await canReadQuoteUpload(url, reader)) return true;
  if (await canReadBuyerLicense(url, reader)) return true;
  return false;
}

export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const segments = params.path;
  if (
    !Array.isArray(segments) ||
    segments.length < 2 ||
    segments.length > 3 ||
    segments.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment) || segment === "." || segment === "..")
  ) {
    return new NextResponse("not found", { status: 404 });
  }

  const root = path.resolve(process.cwd(), "public", "uploads");
  const fp = path.resolve(root, ...segments);
  if (!fp.startsWith(root + path.sep)) return new NextResponse("not found", { status: 404 });

  const name = segments.join("/");
  const url = `/uploads/${name}`;
  const scope = segments[0];
  const reader = scope === "admin-image" ? null : await activeReader();

  let allowed = false;
  let publicAsset = false;
  if (scope === "admin-image" && segments.length === 3) {
    allowed = true;
    publicAsset = true;
  } else if (scope === "product-image" && segments.length === 3) {
    const supplierId = principalId(segments[1], "supplier");
    allowed = !!supplierId && await canReadProductUpload(url, reader, supplierId);
    publicAsset = !!(await prisma.product.findFirst({
      where: { AND: [PUBLIC_PRODUCT_WHERE, { images: { contains: url } }] },
      select: { id: true },
    }));
  } else if (scope === "rfq-image" && segments.length === 3) {
    const companyId = principalId(segments[1], "buyer");
    allowed = !!companyId && await canReadRfqUpload(url, reader, companyId);
    publicAsset = !reader && allowed;
  } else if (scope === "quote-attachment" && segments.length === 3) {
    const supplierId = principalId(segments[1], "supplier");
    allowed = !!supplierId && await canReadQuoteUpload(url, reader, supplierId);
  } else if (scope === "buyer-license" && segments.length === 3) {
    const userId = principalId(segments[1], "buyer");
    allowed = !!userId && await canReadBuyerLicense(url, reader, userId);
  } else if ((scope === "rfq" || scope === "quote") && segments.length === 2) {
    // Legacy flat paths are read only when an existing database record references them.
    allowed = await canReadLegacyUpload(url, reader);
  }

  if (!allowed) return new NextResponse("not found", { status: 404 });

  try {
    const buf = await readFile(fp);
    const ext = segments[segments.length - 1].split(".").pop()?.toLowerCase() || "";
    const type = MIME[ext] || "application/octet-stream";
    const isDocument = ["pdf", "doc", "docx", "xls", "xlsx"].includes(ext);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": publicAsset ? "public, max-age=86400" : "private, no-store",
        ...(isDocument ? { "Content-Disposition": `attachment; filename="${segments[segments.length - 1]}"` } : {}),
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
