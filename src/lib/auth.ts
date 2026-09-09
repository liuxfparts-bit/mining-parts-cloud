/**
 * 轻量认证工具（MVP 占位）
 * 后续接入 NextAuth.js / Lucia Auth
 * 当前：基于 session cookie 的简单角色判断
 */

export type UserRole = "BUYER" | "SUPPLIER" | "ADMIN";

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  supplierId?: number;
}

/**
 * 从请求中获取当前用户（MVP 阶段返回 null，接入认证后替换）
 * TODO: 接入 NextAuth.js
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // MVP 阶段未接入认证，返回 null
  // 生产实现：
  // const session = await getServerSession(authOptions);
  // if (!session?.user) return null;
  // return { id: session.user.id, ... };
  return null;
}

/** 要求登录，否则重定向到登录页 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

/** 要求供应商角色 */
export async function requireSupplier(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "SUPPLIER" && user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/** 要求管理员 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return user;
}
