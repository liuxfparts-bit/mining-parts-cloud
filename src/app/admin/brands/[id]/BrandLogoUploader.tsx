"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BrandLogoUploader({ brandId, initialLogo }: { brandId: number; initialLogo: string | null }) {
  const router = useRouter();
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) { setMsg("文件超过 2MB"); return; }
    setBusy(true); setMsg("正在上传…");
    const fd = new FormData();
    fd.append("file", file);
    const up = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await up.json();
    if (!up.ok || !data.url) { setMsg("上传失败"); setBusy(false); return; }
    const r = await fetch(`/api/admin/brands/${brandId}/logo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo: data.url }),
    });
    if (r.ok) { setLogo(data.url); setMsg("Logo 已保存"); router.refresh(); }
    else setMsg("保存失败");
    setBusy(false);
  }

  async function del() {
    if (!confirm("确定删除该品牌Logo？")) return;
    const r = await fetch(`/api/admin/brands/${brandId}/logo`, { method: "DELETE" });
    if (r.ok) { setLogo(null); setMsg("Logo 已删除"); router.refresh(); }
  }

  return (
    <div>
      <label className="block text-sm mb-1">品牌Logo</label>
      <div className="flex items-center gap-4">
        {logo ? <img src={logo} className="h-16 w-16 object-contain border rounded bg-white" /> : <div className="h-16 w-16 border rounded bg-gray-50 flex items-center justify-center text-gray-400 text-xs">无Logo</div>}
        <div>
          <label className="inline-block bg-blue-600 text-white px-3 py-1.5 rounded text-sm cursor-pointer">
            {busy ? "上传中…" : (logo ? "更换Logo" : "上传Logo")}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} disabled={busy} />
          </label>
          {logo && <button onClick={del} className="ml-2 border px-3 py-1.5 rounded text-sm text-red-600">删除</button>}
        </div>
      </div>
      {msg && <div className="text-xs text-gray-500 mt-2">{msg}</div>}
    </div>
  );
}
