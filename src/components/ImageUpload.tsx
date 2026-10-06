"use client";

import { useState } from "react";

export default function ImageUpload({ name, scope, defaultValue }: { name: string; scope: "rfq-image" | "buyer-license" | "product-image" | "admin-image"; defaultValue?: string }) {
  const [url, setUrl] = useState(defaultValue || "");
  const [uploading, setUploading] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("scope", scope);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    if (j.url) setUrl(j.url);
    setUploading(false);
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} className="block text-sm" />
      {uploading && <p className="text-xs text-gray-500 mt-1">上传中...</p>}
      {url && <img src={url} alt="preview" className="mt-2 h-20 rounded border" />}
    </div>
  );
}
