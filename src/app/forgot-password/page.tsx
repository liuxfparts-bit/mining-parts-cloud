"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      setMsg(j.message || "如果该邮箱对应一个矿配云账号，我们会向该邮箱发送密码重置链接。");
    } catch {
      setMsg("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-slate-50 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center mb-2">找回密码</h1>
        <p className="text-sm text-slate-500 text-center mb-6">输入注册邮箱，我们将发送重置链接</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">邮箱</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="you@example.com" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-bold disabled:opacity-50">
            {loading ? "发送中…" : "发送重置链接"}
          </button>
        </form>
        {msg && (
          <div className="mt-4 p-3 bg-green-50 text-green-700 rounded text-sm">{msg}</div>
        )}
        <div className="text-center mt-4">
          <a href="/login" className="text-sm text-blue-600">返回登录</a>
        </div>
      </div>
    </div>
  );
}
