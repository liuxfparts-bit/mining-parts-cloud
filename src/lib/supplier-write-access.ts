import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SupplierWritePolicy = "PROFILE" | "BUSINESS";
export type SupplierWriteContext = { userId: number; supplierId: number; supplierStatus: string };
export type SupplierWriteFailure = {
  ok: false;
  status: 401 | 403;
  code: "UNAUTHORIZED" | "SUPPLIER_ROLE_REQUIRED" | "SUPPLIER_ACCOUNT_INACTIVE" | "SUPPLIER_NOT_BOUND" | "SUPPLIER_NOT_FOUND" | "SUPPLIER_DISABLED" | "SUPPLIER_REJECTED";
  message: string;
};
export type SupplierWriteResult = ({ ok: true } & SupplierWriteContext) | SupplierWriteFailure;

export function supplierWritePolicyAllowsStatus(policy: SupplierWritePolicy, supplierStatus: string): boolean {
  if (supplierStatus === "DISABLED") return false;
  if (policy === "PROFILE") return ["PENDING", "VERIFIED", "REJECTED"].includes(supplierStatus);
  return ["PENDING", "VERIFIED"].includes(supplierStatus);
}

/**
 * Canonical gate for supplier-side business mutations.
 * Authorization and public trust are intentionally separate. PENDING suppliers
 * may participate in onboarding/invited flows, but their data is not thereby
 * public/trusted. REJECTED suppliers may only correct their profile.
 */
export async function resolveSupplierWriteAccess(policy: SupplierWritePolicy = "BUSINESS"): Promise<SupplierWriteResult> {
  const session = await auth();
  const userId = Number((session?.user as any)?.id);
  if (!session?.user || !Number.isInteger(userId) || userId <= 0) {
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "登录凭证已过期，请重新登录" };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, supplierId: true, supplier: { select: { id: true, verifiedStatus: true } } },
  });
  if (!user || user.role !== "SUPPLIER") return { ok: false, status: 403, code: "SUPPLIER_ROLE_REQUIRED", message: "仅供应商账号可执行此操作" };
  if (user.status !== "ACTIVE") return { ok: false, status: 403, code: "SUPPLIER_ACCOUNT_INACTIVE", message: "供应商账号当前不可用" };
  if (!user.supplierId) return { ok: false, status: 403, code: "SUPPLIER_NOT_BOUND", message: "账号未绑定供应商资料" };
  if (!user.supplier || user.supplier.id !== user.supplierId) return { ok: false, status: 403, code: "SUPPLIER_NOT_FOUND", message: "供应商资料不存在" };

  const supplierStatus = user.supplier.verifiedStatus;
  if (!supplierWritePolicyAllowsStatus(policy, supplierStatus)) {
    if (supplierStatus === "REJECTED") {
      return { ok: false, status: 403, code: "SUPPLIER_REJECTED", message: "供应商企业审核未通过，请先完善企业资料" };
    }
    return { ok: false, status: 403, code: "SUPPLIER_DISABLED", message: "供应商企业当前不可执行此操作" };
  }

  return { ok: true, userId: user.id, supplierId: user.supplierId, supplierStatus };
}

export async function requireSupplierWriteAccess(policy: SupplierWritePolicy = "BUSINESS"): Promise<SupplierWriteContext> {
  const result = await resolveSupplierWriteAccess(policy);
  if (!result.ok) {
    const error = new Error(result.message) as Error & { code?: string; status?: number };
    error.code = result.code; error.status = result.status; throw error;
  }
  return result;
}
