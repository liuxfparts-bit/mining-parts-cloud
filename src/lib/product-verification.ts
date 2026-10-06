export const PRODUCT_TRUST_FIELDS = [
  "partNumberId",
  "supplierId",
  "name",
  "nameEn",
  "productType",
  "oemNumber",
  "description",
  "specification",
  "material",
  "application",
  "images",
  "datasheet",
  "drawing",
] as const;

export const PRODUCT_COMMERCIAL_FIELDS = [
  "price",
  "currency",
  "moq",
  "stockStatus",
  "stock",
  "leadTime",
  "warranty",
] as const;

export type ProductTrustField = (typeof PRODUCT_TRUST_FIELDS)[number];

type ComparableProduct = Record<string, unknown>;

function comparable(value: unknown) {
  if (value === undefined) return "__UNSET__";
  if (value === null) return null;
  if (typeof value === "string") return value.trim();
  return value;
}

export function changedProductTrustFields(
  current: ComparableProduct,
  proposed: ComparableProduct
): ProductTrustField[] {
  return PRODUCT_TRUST_FIELDS.filter((field) => {
    if (proposed[field] === undefined) return false;
    return comparable(current[field]) !== comparable(proposed[field]);
  });
}

export type ProductApprovalDependencySnapshot = {
  partNumberVerificationStatus: string;
  partNumberPublishStatus: string;
  supplierVerifiedStatus: string;
  supplierApprovedAt: Date | string | null;
  supplierApprovedBy: number | null;
  disabledSupplierUsers: number;
};

export function productApprovalDependencyErrors(
  snapshot: ProductApprovalDependencySnapshot
): string[] {
  const errors: string[] = [];
  if (snapshot.partNumberVerificationStatus !== "VERIFIED") {
    errors.push("关联件号尚未 VERIFIED");
  }
  if (snapshot.partNumberPublishStatus !== "READY") {
    errors.push("关联件号尚未 READY");
  }
  if (snapshot.supplierVerifiedStatus !== "VERIFIED") {
    errors.push("供应商主体尚未 VERIFIED");
  }
  if (!snapshot.supplierApprovedAt || snapshot.supplierApprovedBy == null) {
    errors.push("供应商缺少正式审核链");
  }
  if (snapshot.disabledSupplierUsers > 0) {
    errors.push("供应商存在已禁用账号");
  }
  return errors;
}
