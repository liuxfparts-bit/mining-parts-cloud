"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [accountType, setAccountType] = useState<"SUPPLIER" | "BUYER">("SUPPLIER");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = e.currentTarget;
    const data = new FormData(form);
    const company = (data.get("company") as string)?.trim();
    const contactName = (data.get("contactName") as string)?.trim();
    const phone = (data.get("phone") as string)?.trim();
    const email = (data.get("email") as string)?.trim();
    const password = data.get("password") as string;
    const role: "SUPPLIER" | "BUYER" = accountType;

    // 前端校验
    if (role === "SUPPLIER" && !company) return setError("供应商注册请填写企业全称"), setLoading(false);
    if (!contactName) return setError("请填写联系人姓名"), setLoading(false);
    if (!phone) return setError("请填写手机号/WhatsApp"), setLoading(false);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("请填写正确的邮箱"), setLoading(false);
    if (!password || password.length < 6) return setError("密码至少6位"), setLoading(false);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, contactName, phone, email, password, role }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "注册失败，请稍后重试");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/login?registered=1"), 1500);
      }
    } catch {
      setError("网络错误，请检查连接后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-[42px]">
      <div className="max-w-[800px] mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-3">免费入驻矿配云</h1>
          <p className="text-lg text-gray-500">展示您的矿山设备与配件业务</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {[
            { n: "01", t: "企业信息" }, { n: "02", t: "联系方式" },
            { n: "03", t: "主营品牌" }, { n: "04", t: "主营设备" },
            { n: "05", t: "主营产品" }, { n: "06", t: "企业介绍" },
            { n: "07", t: "上传产品" },
          ].map((s) => (
            <div key={s.n} className="bg-white border rounded-lg p-4 text-center">
              <div className="text-blue-600 font-bold">{s.n}</div>
              <div className="text-sm font-medium mt-1">{s.t}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border rounded-lg p-8">
          <h2 className="text-xl font-bold mb-6">创建账号</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">
              注册成功，正在跳转登录页...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 max-w-[400px]">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAccountType("SUPPLIER")}
                className={`py-2 rounded border text-sm ${accountType === "SUPPLIER" ? "bg-blue-600 text-white border-blue-600" : "bg-white"}`}>
                我是供应商
              </button>
              <button type="button" onClick={() => setAccountType("BUYER")}
                className={`py-2 rounded border text-sm ${accountType === "BUYER" ? "bg-blue-600 text-white border-blue-600" : "bg-white"}`}>
                我是采购商
              </button>
            </div>
            {accountType === "SUPPLIER" && (
              <input name="company" className="w-full border rounded-md px-3 py-2.5 text-sm" placeholder="企业全称 *" required />
            )}
            <input name="contactName" className="w-full border rounded-md px-3 py-2.5 text-sm" placeholder="联系人姓名 *" required />
            <input name="phone" className="w-full border rounded-md px-3 py-2.5 text-sm" placeholder="手机号 / WhatsApp *" required />
            <input name="email" type="email" className="w-full border rounded-md px-3 py-2.5 text-sm" placeholder="工作邮箱 *" required />
            <input name="password" type="password" minLength={6} className="w-full border rounded-md px-3 py-2.5 text-sm" placeholder="设置密码（至少6位）*" required />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "注册中..." : "免费注册并入驻"}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-4">
            已有账号？<a href="/login" className="text-blue-600">立即登录</a>
          </p>
        </div>
      </div>
    </div>
  );
}
