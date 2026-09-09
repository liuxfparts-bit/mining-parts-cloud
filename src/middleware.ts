import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = (req.auth as any)?.user?.role;
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isLoginRoute = nextUrl.pathname === "/login";

  if (isAdminRoute && (!isLoggedIn || role !== "ADMIN")) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isLoginRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }
});

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
