"use client";

import { useState } from "react";

export default function EquipmentImageUploader({ name = "imageUrl", initialUrl = "" }: { name?: string; initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await r.json();
    if (data.url) {
      setUrl(data.url);
      const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (input) input.value = data.url;
    }
    setBusy(false);
  }

  function clear() {
    setUrl("");
    const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (input) input.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <input type="hidden" name={name} value={url} />
        <label className="border px-3 py-2 rounded text-sm cursor-pointer whitespace-nowrap bg-gray-50">
          {busy ? "上传中…" : url ? "更换图片" : "选择图片"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {url && <button type="button" onClick={clear} className="text-xs text-red-600">删除图片</button>}
      </div>
      {url && <img src={url} className="h-24 object-contain border rounded" />}
    </div>
  );
}
