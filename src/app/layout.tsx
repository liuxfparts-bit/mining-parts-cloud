import type { Metadata } from "next";
import "./globals.css";
import "./home.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileNav from "@/components/MobileNav";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { Suspense } from "react";

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/brand/kpy-favicon-20261028.ico", sizes: "any" },
      { url: "/brand/kpy-icon-192-20261028.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/brand/kpy-favicon-20261028.ico",
    apple: [{ url: "/brand/kpy-apple-touch-20261028.png", sizes: "180x180", type: "image/png" }],
  },
  title: "矿配云 | Mining Parts Cloud - 找设备 · 找配件 · 找厂家 · 发询价",
  description:
    "中国矿山设备与配件专业展示、找货与询价平台。通过设备型号找到相关配件，再找到可供应该件号的厂家，一键向多个厂家询价。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col">
        <Suspense fallback={null}><AnalyticsTracker /></Suspense>
        <Header />
        <main className="flex-1 pb-16 lg:pb-0">{children}</main>
        <Footer />
        <MobileNav />
      </body>
    </html>
  );
}
