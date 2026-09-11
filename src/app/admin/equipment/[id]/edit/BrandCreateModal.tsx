"use client";

import { useState } from "react";

type Brand = { id: number; name: string };

export default function BrandCreateModal({ onCreated, onClose }: { onCreated: (b: Brand) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [logo, setLogo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await r.json();
    if (d.url) setLogo(d.url);
  }

  async function save() {
    if (!name.trim()) { setErr("品牌名必填"); return; }
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/brands/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, nameEn, logo }),
    });
    const d = await r.json();
    if (!r.ok || d.error) { setErr(d.error || "创建失败"); setBusy(false); return; }
    onCreated(d.brand);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">新建品牌</h3>
        <div className="space-y-3">
          <input placeholder="品牌名 *" value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
          <input placeholder="英文名" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
          <div>
            <label className="text-xs block mb-1">Logo</label>
            <div className="flex items-center gap-2">
              {logo ? <img src={logo} className="h-10 object-contain border rounded" /> : null}
              <label className="border px-3 py-1.5 text-xs cursor-pointer bg-gray-50">
                {logo ? "更换Logo" : "上传Logo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </div>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">取消</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 text-sm bg-blue-600 text-white rounded">{busy ? "保存中…" : "保存品牌"}</button>
        </div>
      </div>
    </div>
  );
}
