"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setMsg("两次密码不一致"); setOk(false); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json();
      if (j.ok) {
        setOk(true);
        setMsg("密码已重置，即将跳转登录…");
        setTimeout(() => (location.href = "/login"), 1500);
      } else {
        setOk(false);
        setMsg(j.message || "重置失败");
      }
    } catch {
      setMsg("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">新密码</label>
        <input type="password" required minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm" placeholder="至少 8 位，含字母和数字" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">确认新密码</label>
        <input type="password" required minLength={8} value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={loading || !token}
        className="w-full bg-blue-600 text-white py-2 rounded font-bold disabled:opacity-50">
        {loading ? "提交中…" : "重置密码"}
      </button>
      {msg && (
        <div className={`p-3 rounded text-sm ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg}
        </div>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-slate-50 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center mb-6">设置新密码</h1>
        <Suspense fallback={<div className="text-center text-sm text-gray-400">加载中…</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
