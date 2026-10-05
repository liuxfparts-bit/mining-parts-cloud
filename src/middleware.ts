import { NextResponse } from "next/server";
import { edgeAuth } from "@/lib/auth-edge";

export default edgeAuth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = (req.auth as any)?.user?.role;
  const path = nextUrl.pathname;

  // 根路径：手机 H5 首页 / 角色工作台分流
  if (path === "/") {
    const ua = req.headers.get("user-agent") || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(ua);
    if (isMobile) {
      if (isLoggedIn) {
        // 手机已登录访问根路径：按角色进入对应工作台（修复手机登录成功后被劫持到 H5 首页的“无法登录”问题）
        if (role === "ADMIN") return NextResponse.redirect(new URL("/admin", nextUrl));
        if (role === "SUPPLIER") return NextResponse.redirect(new URL("/supplier", nextUrl));
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }
      // 未登录手机 → H5 首页
      return NextResponse.redirect(new URL("/m", nextUrl));
    }
    // PC（登录或未登录）→ 渲染 PC 首页，行为不变
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

  // Buyer dashboard 保护 + 角色纠正（双保险：登录跳转出错时也能纠正到正确工作台）
  if (path === "/dashboard") {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", nextUrl));
    if (role === "ADMIN") return NextResponse.redirect(new URL("/admin", nextUrl));
    if (role === "SUPPLIER") return NextResponse.redirect(new URL("/supplier", nextUrl));
    // BUYER 正常放行
  }

  // /login intentionally does not redirect in Edge middleware.
  // The login page calls the Node.js auth() implementation, which validates
  // status/role/sessionVersion against PostgreSQL. This prevents a stale JWT
  // from bouncing between /login and a protected route after session revocation.
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
