"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  product: {
    id: number; name: string; productType: string; price: number | string; currency: string;
    moq: number; stockStatus: string; stock: number | string; leadTime: string; warranty: string;
    description: string; images: string[]; status: string;
  };
};

export default function ProductEditClient({ product }: Props) {
  const router = useRouter();
  const [images, setImages] = useState(product.images);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const f = "border rounded px-3 py-2 text-sm w-full";

  async function uploadOne(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", f);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    if (j.url) setImages((arr) => [...arr, j.url]);
    setUploading(false);
  }

  async function save(draft: boolean) {
    setLoading(true);
    const body: any = {};
    new FormData(document.getElementById("pf") as HTMLFormElement).forEach((v, k) => body[k] = v);
    body.images = images.join(",");
    body.action = draft ? "update" : "resubmit";
    const res = await fetch(`/api/supplier/product/${product.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await res.json();
    if (j.success) router.push("/supplier/products");
    else alert(j.message || "保存失败");
    setLoading(false);
  }

  return (
    <form id="pf" className="space-y-4 bg-white p-6 rounded-lg border">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm mb-1">产品名称</label><input name="name" defaultValue={product.name} className={f} /></div>
        <div><label className="block text-sm mb-1">产品类型</label>
          <select name="productType" className={f} defaultValue={product.productType}>
            <option value="Aftermarket">售后件</option><option value="OEM">原厂件 OEM</option>
            <option value="OEM Compatible">OEM 兼容件</option><option value="Replacement">替换件</option>
            <option value="Used">二手件</option><option value="Reconditioned">翻新/再制造</option>
          </select></div>
        <div><label className="block text-sm mb-1">价格</label><input name="price" type="number" step="0.01" defaultValue={product.price} className={f} /></div>
        <div><label className="block text-sm mb-1">货币</label><select name="currency" className={f} defaultValue={product.currency}><option>CNY</option><option>USD</option><option>EUR</option><option>RUB</option></select></div>
        <div><label className="block text-sm mb-1">MOQ</label><input name="moq" type="number" defaultValue={product.moq} className={f} /></div>
        <div><label className="block text-sm mb-1">库存状态</label><select name="stockStatus" className={f} defaultValue={product.stockStatus}><option value="IN_STOCK">现货</option><option value="MADE_TO_ORDER">按订单生产</option></select></div>
        <div><label className="block text-sm mb-1">库存数量</label><input name="stock" type="number" defaultValue={product.stock} className={f} /></div>
        <div><label className="block text-sm mb-1">交期</label><input name="leadTime" defaultValue={product.leadTime} className={f} /></div>
        <div><label className="block text-sm mb-1">质保</label><input name="warranty" defaultValue={product.warranty} className={f} /></div>
      </div>
      <div><label className="block text-sm mb-1">描述</label><textarea name="description" rows={3} defaultValue={product.description} className={f} /></div>
      <div>
        <label className="block text-sm mb-1">图片</label>
        {images.map((src, i) => (<div key={src} className="inline-block relative mr-2 mb-2"><img src={src} className="h-20 rounded border" /><button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs">×</button></div>))}
        <input type="file" accept="image/*" onChange={uploadOne} disabled={uploading} className="block text-sm" />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={() => save(true)} disabled={loading} className="border px-4 py-2 rounded text-sm">保存草稿</button>
        <button type="button" onClick={() => save(false)} disabled={loading} className="flex-1 bg-blue-600 text-white px-6 py-2 rounded">
          {product.status === "REJECTED" ? "重新提交审核" : "提交审核"}
        </button>
      </div>
    </form>
  );
}
