"use client";

import { useState } from "react";

export default function ResetPwButton({ userId, userEmail }: { userId: number; userEmail: string }) {
  const [open, setOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function doReset() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const j = await r.json();
      if (j.ok) setNewPw(j.password);
      else setErr(j.message || "失败");
    } catch {
      setErr("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setNewPw(""); setErr(""); }}
        className="text-blue-600 hover:underline">
        重置密码
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[420px]">
            {!newPw ? (
              <>
                <h3 className="font-bold mb-2">重置用户密码</h3>
                <p className="text-sm text-gray-600 mb-4">
                  确定要为 <b>{userEmail}</b> 重置密码吗？系统将生成一个一次性随机密码。
                </p>
                {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="px-4 py-2 border rounded">取消</button>
                  <button onClick={doReset} disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50">
                    {loading ? "重置中…" : "确认重置"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold mb-2">密码已重置</h3>
                <p className="text-sm text-gray-600 mb-3">
                  该密码仅显示一次，请立即保存并通过安全渠道通知 <b>{userEmail}</b>：
                </p>
                <div className="bg-gray-100 p-3 rounded font-mono text-sm mb-3 break-all">{newPw}</div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => navigator.clipboard.writeText(newPw)}
                    className="px-4 py-2 border rounded">复制密码</button>
                  <button onClick={() => setOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded">关闭</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
