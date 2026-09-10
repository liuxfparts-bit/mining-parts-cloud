"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  partNumbers: { id: number; number: string; name: string }[];
  maxImages: number;
  memberLevel: string;
};

const MEMBER_CN: Record<string, string> = {
  FREE: "免费会员", BRONZE: "铜牌", SILVER: "银牌", GOLD: "金牌",
};

export default function NewProductClient({ partNumbers, maxImages, memberLevel }: Props) {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function uploadOne(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (images.length >= maxImages) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    if (j.url) setImages((arr) => [...arr, j.url]);
    setUploading(false);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd);
    body.images = images.join(",");
    const res = await fetch("/api/supplier/product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (j.success) router.push("/supplier/products");
    else alert(j.message || "提交失败");
    setLoading(false);
  }

  const f = "border rounded px-3 py-2 text-sm w-full";

  return (
    <form onSubmit={submit} className="bg-white rounded-lg border p-6 space-y-4">
      <div className="text-sm text-gray-500">当前会员：{MEMBER_CN[memberLevel] || memberLevel}，最多上传 {maxImages} 张图片</div>
      <div>
        <label className="block text-sm mb-1">关联件号 *</label>
        <select name="partNumberId" required className={f}>
          <option value="">选择件号</option>
          {partNumbers.map((p) => (
            <option key={p.id} value={p.id}>{p.number} - {p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm mb-1">产品名称 *</label>
        <input name="name" required className={f} />
      </div>
      <div>
        <label className="block text-sm mb-1">报价（人民币 ¥）</label>
        <input name="price" type="number" step="0.01" className={f} />
      </div>
      <div>
        <label className="block text-sm mb-1">产品图片（选填，最多 {maxImages} 张）</label>
        {images.map((src, i) => (
          <div key={src} className="inline-block relative mr-2 mb-2">
            <img src={src} className="h-20 rounded border" />
            <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs">×</button>
          </div>
        ))}
        {images.length < maxImages && (
          <input type="file" accept="image/*" onChange={uploadOne} disabled={uploading} className="block text-sm mt-1" />
        )}
      </div>
      <button disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50">
        {loading ? "提交中..." : "提交（待管理员审核）"}
      </button>
    </form>
  );
}
