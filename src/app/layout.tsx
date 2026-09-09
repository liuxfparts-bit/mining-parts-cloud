import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileNav from "@/components/MobileNav";

export const metadata: Metadata = {
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
        <Header />
        <main className="flex-1 pb-16 lg:pb-0">{children}</main>
        <Footer />
        <MobileNav />
      </body>
    </html>
  );
}
