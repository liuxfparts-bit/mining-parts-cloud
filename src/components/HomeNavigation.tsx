"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Search, X, Globe } from "lucide-react";
import UserMenu from "@/components/UserMenu";

const links = [
  ["零件搜索", "/search"], ["设备分类", "/equipment"], ["品牌中心", "/brands"],
  ["供应商", "/suppliers"], ["询价市场", "/rfqs"], ["资源中心", "/services"], ["关于我们", "/about"],
];

export default function HomeNavigation({ name, role }: { name?: string; role?: string }) {
  const [open, setOpen] = useState(false);
  return <div className="home-navigation"><div className="home-container home-navigation-inner">
    <Link href="/" className="home-logo home-logo--wordmark" aria-label="矿配云首页"><img src="/brand/kpy-logo-20261028.png" alt="矿配云 Mining Parts Cloud" /></Link>
    <nav className="home-desktop-links" aria-label="首页主导航">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
    <div className="home-account"><span className="home-language"><Globe size={16} />中文</span>{name ? <UserMenu name={name} role={role} /> : <><Link className="home-login" href="/login">登录</Link><Link className="home-register" href="/register">注册</Link></>}{role === "ADMIN" && <Link className="home-admin" href="/admin">平台审核</Link>}</div>
    <div className="home-mobile-controls"><Link href="/search" aria-label="搜索"><Search size={21} /></Link><button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="home-mobile-menu" aria-label={open ? "关闭导航" : "打开导航"}>{open ? <X size={23} /> : <Menu size={23} />}</button></div>
  </div>{open && <nav id="home-mobile-menu" className="home-mobile-menu" aria-label="手机主导航">{links.map(([label, href]) => <Link onClick={() => setOpen(false)} key={href} href={href}>{label}</Link>)}<div className="home-mobile-account">{name ? <UserMenu name={name} role={role} /> : <><Link href="/login">登录</Link><Link href="/register">注册</Link></>}{role === "ADMIN" && <Link href="/admin">平台审核</Link>}</div></nav>}</div>;
}
