import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = (req.auth as any)?.user?.role;
  const path = nextUrl.pathname;

  // 手机访问根路径 → 跳 H5
  if (path === "/") {
    const ua = req.headers.get("user-agent") || "";
    if (/Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(ua)) {
      return NextResponse.redirect(new URL("/m", nextUrl));
    }
  }

  // Admin 路由保护
  if (path.startsWith("/admin")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  // Supplier 路由保护
  if (path.startsWith("/supplier")) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", nextUrl));
    if (role !== "SUPPLIER" && role !== "ADMIN") return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Buyer dashboard 保护
  if (path === "/dashboard" && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // 已登录访问登录页：按角色跳转
  if (path === "/login" && isLoggedIn) {
    if (role === "ADMIN") return NextResponse.redirect(new URL("/admin", nextUrl));
    if (role === "SUPPLIER") return NextResponse.redirect(new URL("/supplier", nextUrl));
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
});

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/supplier/:path*",
    "/login",
    "/dashboard",
  ],
};
