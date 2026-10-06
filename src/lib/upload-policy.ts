import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireVerifiedBuyer } from "@/lib/buyer-company";
import { resolveSupplierWriteAccess } from "@/lib/supplier-write-access";

export type UploadScope = "rfq-image" | "buyer-license" | "quote-attachment" | "product-image" | "admin-image";

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
const DOC_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const UPLOAD_POLICIES: Record<UploadScope, { role: "BUYER" | "SUPPLIER" | "ADMIN"; allowedMimes: readonly string[] }> = {
  "rfq-image": { role: "BUYER", allowedMimes: IMAGE_MIMES },
  "buyer-license": { role: "BUYER", allowedMimes: IMAGE_MIMES },
  "quote-attachment": { role: "SUPPLIER", allowedMimes: [...IMAGE_MIMES, ...DOC_MIMES] },
  "product-image": { role: "SUPPLIER", allowedMimes: IMAGE_MIMES },
  "admin-image": { role: "ADMIN", allowedMimes: IMAGE_MIMES },
};

export const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export function isUploadScope(value: string): value is UploadScope {
  return Object.prototype.hasOwnProperty.call(UPLOAD_POLICIES, value);
}

export function uploadPrincipal(role: "BUYER" | "SUPPLIER" | "ADMIN", id: number): string {
  if (!Number.isInteger(id) || id <= 0) throw new Error("invalid upload principal id");
  if (role === "BUYER") return `buyer-${id}`;
  if (role === "SUPPLIER") return `supplier-${id}`;
  return `admin-${id}`;
}

export function ownedUploadPrefix(scope: UploadScope, principal: string): string {
  if (!/^(buyer|supplier|admin)-[1-9]\d*$/.test(principal)) throw new Error("invalid upload principal");
  return `/uploads/${scope}/${principal}/`;
}

export function isOwnedUploadUrl(url: unknown, scope: UploadScope, principal: string): boolean {
  if (typeof url !== "string") return false;
  const prefix = ownedUploadPrefix(scope, principal);
  if (!url.startsWith(prefix)) return false;
  const name = url.slice(prefix.length);
  return /^[0-9]+-[a-f0-9]{12}\.(jpg|png|webp|pdf|doc|docx|xls|xlsx)$/.test(name);
}

export function splitStoredUploadUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (typeof value !== "string" || !value.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
    } catch {
      return [];
    }
  }
  return trimmed.split(",").map((v) => v.trim()).filter(Boolean);
}

export function uploadUrlsBelongToPrincipal(
  urls: string[],
  scope: UploadScope,
  principal: string,
  grandfathered: string[] = []
): boolean {
  const old = new Set(grandfathered);
  return urls.every((url) => old.has(url) || isOwnedUploadUrl(url, scope, principal));
}

export function fileSignatureMatches(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 4) return false;
  if (mime === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mime === "image/webp") return buffer.length >= 12 && buffer.subarray(0,4).toString("ascii") === "RIFF" && buffer.subarray(8,12).toString("ascii") === "WEBP";
  if (mime === "application/pdf") return buffer.subarray(0,5).toString("ascii") === "%PDF-";
  if (mime === "application/msword" || mime === "application/vnd.ms-excel") {
    return buffer.subarray(0,8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]));
  }
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const sig = buffer.subarray(0,4);
    return sig.equals(Buffer.from([0x50,0x4b,0x03,0x04])) ||
      sig.equals(Buffer.from([0x50,0x4b,0x05,0x06])) ||
      sig.equals(Buffer.from([0x50,0x4b,0x07,0x08]));
  }
  return false;
}

export type UploadAuthorization =
  | { ok: true; userId: number; scope: UploadScope; principal: string; allowedMimes: readonly string[] }
  | { ok: false; status: 400 | 401 | 403; code: string; message: string };

export async function resolveUploadAuthorization(scopeRaw: string): Promise<UploadAuthorization> {
  if (!isUploadScope(scopeRaw)) {
    return { ok: false, status: 400, code: "INVALID_UPLOAD_SCOPE", message: "上传用途无效" };
  }
  const session = await auth();
  const userId = Number((session?.user as any)?.id);
  if (!session?.user || !Number.isInteger(userId) || userId <= 0) {
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "登录凭证已过期，请重新登录" };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, supplierId: true, buyerCompanyId: true },
  });
  if (!user || user.status !== "ACTIVE") {
    return { ok: false, status: 403, code: "ACCOUNT_INACTIVE", message: "账号当前不可上传文件" };
  }

  const policy = UPLOAD_POLICIES[scopeRaw];
  if (user.role !== policy.role) {
    return { ok: false, status: 403, code: "UPLOAD_SCOPE_FORBIDDEN", message: "当前账号无权使用该上传用途" };
  }

  if (policy.role === "ADMIN") {
    return { ok: true, userId, scope: scopeRaw, principal: uploadPrincipal("ADMIN", userId), allowedMimes: policy.allowedMimes };
  }
  if (policy.role === "BUYER") {
    if (scopeRaw === "buyer-license") {
      return { ok: true, userId, scope: scopeRaw, principal: uploadPrincipal("BUYER", userId), allowedMimes: policy.allowedMimes };
    }
    if (!user.buyerCompanyId) return { ok: false, status: 403, code: "BUYER_COMPANY_REQUIRED", message: "账号未绑定采购企业" };
    const gate = await requireVerifiedBuyer(userId);
    if (!gate.allowed || !gate.company) return { ok: false, status: 403, code: "BUYER_NOT_VERIFIED", message: gate.reason || "采购企业未认证" };
    return { ok: true, userId, scope: scopeRaw, principal: uploadPrincipal("BUYER", gate.company.id), allowedMimes: policy.allowedMimes };
  }

  const supplier = await resolveSupplierWriteAccess("BUSINESS");
  if (!supplier.ok) return { ok: false, status: supplier.status, code: supplier.code, message: supplier.message };
  if (supplier.userId !== userId || supplier.supplierId !== user.supplierId) {
    return { ok: false, status: 403, code: "SUPPLIER_BINDING_MISMATCH", message: "供应商绑定关系异常" };
  }
  return { ok: true, userId, scope: scopeRaw, principal: uploadPrincipal("SUPPLIER", supplier.supplierId), allowedMimes: policy.allowedMimes };
}
