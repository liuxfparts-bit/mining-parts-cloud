// 认证状态中文映射（全站统一）
export function verifiedStatusCN(status?: string | null): string {
  switch (status) {
    case "VERIFIED":
      return "已认证";
    case "REJECTED":
      return "已驳回";
    case "PENDING":
      return "待审核";
    default:
      return status || "待审核";
  }
}
