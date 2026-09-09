import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = (req.auth as any)?.user?.role;
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isLoginRoute = nextUrl.pathname === "/login";

  // Admin 路由：必须是 ADMIN
  if (isAdminRoute) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", nextUrl));
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // 已登录访问登录页：按角色跳转
  if (isLoginRoute && isLoggedIn) {
    if (role === "ADMIN") return NextResponse.redirect(new URL("/admin", nextUrl));
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
});

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
