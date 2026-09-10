"use client";

import { useState } from "react";

export default function ImageUpload({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [url, setUrl] = useState(defaultValue || "");
  const [uploading, setUploading] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    if (j.url) setUrl(j.url);
    setUploading(false);
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <input type="file" accept="image/*" onChange={onChange} className="block text-sm" />
      {uploading && <p className="text-xs text-gray-500 mt-1">上传中...</p>}
      {url && <img src={url} alt="preview" className="mt-2 h-20 rounded border" />}
    </div>
  );
}
