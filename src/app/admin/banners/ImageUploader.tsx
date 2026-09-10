"use client";

import { useState } from "react";

export default function ImageUploader() {
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await r.json();
    if (data.url) {
      (document.getElementById("imageUrlInput") as HTMLInputElement).value = data.url;
    }
    setBusy(false);
  }
  return (
    <label className="border px-3 py-2 rounded text-sm cursor-pointer whitespace-nowrap">
      {busy ? "上传中…" : "上传图片"}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </label>
  );
}
