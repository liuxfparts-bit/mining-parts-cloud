import fs from "node:fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}
function must(text: string, needle: string, label: string) {
  if (!text.includes(needle)) throw new Error("WP0-4 failed: " + label);
}

const schema = read("prisma/schema.prisma");
const auth = read("src/lib/auth.ts");
const change = read("src/app/api/account/change-password/route.ts");
const reset = read("src/app/api/auth/reset-password/route.ts");
const adminReset = read("src/app/api/admin/users/reset-password/route.ts");
const users = read("src/app/admin/users/page.tsx");
const adminActions = read("src/app/admin/actions.ts");
const auditPage = read("src/app/admin/security-audit/page.tsx");
const migration = read("prisma/migrations/0006_admin_security_audit/migration.sql");

must(schema, "sessionVersion Int      @default(0)", "User sessionVersion missing");
must(schema, "model SecurityAuditLog", "SecurityAuditLog model missing");
must(migration, 'ADD COLUMN "sessionVersion"', "sessionVersion migration missing");
must(migration, 'CREATE TABLE "SecurityAuditLog"', "audit migration missing");

must(auth, "select: { role: true, status: true, sessionVersion: true }", "auth does not refresh security state");
must(auth, 'current.status !== "ACTIVE"', "disabled user session is not invalidated");
must(auth, "current.sessionVersion !== Number(token.sessionVersion)", "session version mismatch is not enforced");
must(auth, "token.invalidated", "invalidated JWT marker missing");

must(change, "sessionVersion: { increment: 1 }", "change-password does not revoke sessions");
must(change, 'action: "PASSWORD_CHANGED"', "change-password audit missing");
must(reset, "sessionVersion: { increment: 1 }", "reset-password does not revoke sessions");
must(reset, 'action: "PASSWORD_RESET_COMPLETED"', "reset-password audit missing");
must(reset, "passwordResetToken.updateMany", "unused reset links are not invalidated");

must(adminReset, "actorUserId === userId", "admin self-reset guard missing");
must(adminReset, "sessionVersion: { increment: 1 }", "admin reset does not revoke target sessions");
must(adminReset, 'action: "ADMIN_PASSWORD_RESET"', "admin reset audit missing");

must(users, "getAdminContinuityStatus", "admin continuity status missing");
must(users, "至少保留 2 个受控管理员账户", "single-admin warning missing");
must(auditPage, "securityAuditLog.findMany", "audit viewer missing");

for (const action of [
  "SUPPLIER_APPROVED",
  "SUPPLIER_REJECTED",
  "SUPPLIER_STATUS_CHANGED",
  "PRODUCT_STATUS_CHANGED",
  "PRODUCT_APPROVED",
  "PRODUCT_REJECTED",
  "RFQ_STATUS_CHANGED",
]) {
  must(adminActions, 'action: "' + action + '"', "missing admin audit action " + action);
}

console.log("WP0-4 admin security and audit checks passed");
