import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = (req.auth as any)?.user?.role;
  const path = nextUrl.pathname;

  // Admin 路由保护
  if (path.startsWith("/admin")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  // 已登录访问登录页：按角色跳转
  if (path === "/login" && isLoggedIn) {
    if (role === "ADMIN") return NextResponse.redirect(new URL("/admin", nextUrl));
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/login",
  ],
};
