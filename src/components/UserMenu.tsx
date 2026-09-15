"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

export default function UserMenu({
  name,
  role,
}: {
  name: string;
  role?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击组件外部自动收起菜单
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const initial = (name || "用").trim()[0] || "用";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer list-none flex items-center gap-2 text-sm"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
          {initial}
        </span>
        <span>{name}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-lg py-2 text-sm z-[70]">
          {role === "ADMIN" && (
            <>
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="block px-4 py-1.5 hover:bg-gray-50"
              >
                管理后台大盘
              </Link>
              <Link
                href="/admin/companies/pending"
                onClick={() => setOpen(false)}
                className="block px-4 py-1.5 hover:bg-gray-50"
              >
                企业入驻审核
              </Link>
            </>
          )}
          {role === "SUPPLIER" && (
            <>
              <Link
                href="/supplier"
                onClick={() => setOpen(false)}
                className="block px-4 py-1.5 hover:bg-gray-50"
              >
                供应商工作台
              </Link>
              <Link
                href="/supplier/profile"
                onClick={() => setOpen(false)}
                className="block px-4 py-1.5 hover:bg-gray-50"
              >
                企业资料管理
              </Link>
            </>
          )}
          {role === "BUYER" && (
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="block px-4 py-1.5 hover:bg-gray-50"
            >
              我的询价单
            </Link>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-red-600"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
