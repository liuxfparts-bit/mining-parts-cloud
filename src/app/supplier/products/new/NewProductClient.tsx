"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type PN = { id: number; number: string; name: string; brand?: { name: string } | null; equipment?: { model: string } | null; category?: string | null };

export default function NewProductClient({ maxImages, memberLevel, preselect }: { maxImages: number; memberLevel: string; preselect?: PN | null }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(preselect ? 2 : 1);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PN[]>([]);
  const [selected, setSelected] = useState<PN | null>(preselect || null);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dup, setDup] = useState<string>("");

  async function search(term: string) {
    if (!term) { setResults([]); return; }
    const res = await fetch(`/api/part-number/search?q=${encodeURIComponent(term)}`);
    const j = await res.json();
    setResults(j.items || []);
  }
  useEffect(() => {
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  async function choose(pn: PN) {
    const res = await fetch(`/api/supplier/product/check?partNumberId=${pn.id}`);
    const j = await res.json();
    if (j.exists) { setDup(`您已经为该件号发布产品`); return; }
    setDup("");
    setSelected(pn);
    setStep(2);
  }

  async function uploadOne(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || images.length >= maxImages) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", f);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    if (j.url) setImages((arr) => [...arr, j.url]);
    setUploading(false);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>, draft: boolean) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const body: any = {
      partNumberId: selected.id,
      name: selected.name,
      productType: fd.get("productType"),
      price: parseFloat(fd.get("price") as string) || null,
      currency: fd.get("currency"),
      moq: parseInt(fd.get("moq") as string) || 1,
      stockStatus: fd.get("stockStatus"),
      stock: parseInt(fd.get("stock") as string) || null,
      leadTime: fd.get("leadTime"),
      warranty: fd.get("warranty"),
      description: fd.get("description"),
      images: images.join(","),
      status: draft ? "DRAFT" : "PENDING",
    };
    const res = await fetch("/api/supplier/product", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await res.json();
    if (j.success) router.push("/supplier/products");
    else alert(j.message || "提交失败");
    setLoading(false);
  }

  const f = "border rounded px-3 py-2 text-sm w-full";
  const MEMBER_CN: Record<string, string> = { FREE: "免费", BRONZE: "铜牌", SILVER: "银牌", GOLD: "金牌" };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center gap-4 mb-6 text-sm">
        <div className={step === 1 ? "font-bold text-blue-600" : "text-gray-500"}>① 找件号</div>
        <div className="flex-1 h-px bg-gray-200" />
        <div className={step === 2 ? "font-bold text-blue-600" : "text-gray-500"}>② 报你的货</div>
      </div>

      {step === 1 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">先找到平台已有件号，再填写您的供应产品信息。</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="输入件号，例如：100080382"
            className={f + " mb-4"} />
          {dup && <div className="bg-red-50 text-red-700 p-3 rounded mb-3 text-sm">{dup}</div>}
          {results.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="p-2 text-left">件号</th><th className="p-2 text-left">名称</th><th className="p-2 text-left">品牌</th><th className="p-2 text-left">设备</th><th></th></tr></thead>
              <tbody>
                {results.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-2 font-mono">{p.number}</td>
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.brand?.name}</td>
                    <td className="p-2">{p.equipment?.model}</td>
                    <td className="p-2"><button onClick={() => choose(p)} className="text-blue-600">选择</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {q && results.length === 0 && (
            <div className="text-sm">
              <p className="text-gray-600 mb-2">未找到平台件号：<span className="font-mono font-bold">{q}</span></p>
              <p className="text-gray-500 mb-3">如果平台暂时没有该件号，您可以申请新增。审核通过后即可发布供应产品。</p>
              <a href={`/supplier/part-number-requests/new?partNumber=${encodeURIComponent(q)}`}
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm mr-2">申请新增件号</a>
              <button onClick={() => setQ("")} className="border px-4 py-2 rounded text-sm">重新搜索</button>
            </div>
          )}
        </div>
      )}

      {step === 2 && selected && (
        <form onSubmit={(e) => submit(e, (e.nativeEvent as SubmitEvent).submitter?.getAttribute("formAction") === "draft")} className="space-y-4">
          <div className="bg-gray-50 p-4 rounded text-sm">
            <div className="font-mono font-bold text-lg">{selected.number}</div>
            <div>{selected.name}</div>
            <div className="text-gray-500 mt-1">品牌：{selected.brand?.name} 设备：{selected.equipment?.model} 分类：{selected.category}</div>
            <p className="text-xs text-gray-400 mt-2">以上为平台件号基础信息，供应商无需重复填写。</p>
          </div>

          <div>
            <label className="block text-sm mb-1">产品类型 *</label>
            <select name="productType" required className={f}>
              <option value="Aftermarket">售后件</option>
              <option value="OEM">原厂件 OEM</option>
              <option value="OEM Compatible">OEM 兼容件</option>
              <option value="Replacement">替换件</option>
              <option value="Used">二手件</option>
              <option value="Reconditioned">翻新/再制造</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">产品类型为供应商声明，不代表平台对产品品牌或原厂身份的保证。</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm mb-1">价格</label><input name="price" type="number" step="0.01" className={f} /></div>
            <div><label className="block text-sm mb-1">货币</label><select name="currency" className={f}><option>CNY</option><option>USD</option><option>EUR</option><option>RUB</option></select></div>
            <div><label className="block text-sm mb-1">MOQ</label><input name="moq" type="number" className={f} /></div>
            <div><label className="block text-sm mb-1">库存状态</label>
              <select name="stockStatus" className={f}>
                <option value="IN_STOCK">现货</option>
                <option value="MADE_TO_ORDER">按订单生产</option>
              </select></div>
            <div><label className="block text-sm mb-1">库存数量</label><input name="stock" type="number" className={f} /></div>
            <div><label className="block text-sm mb-1">交期</label><input name="leadTime" placeholder="现货 / 3-5天 / 2-4周" className={f} /></div>
            <div><label className="block text-sm mb-1">质保</label><input name="warranty" placeholder="12个月" className={f} /></div>
          </div>
          <div><label className="block text-sm mb-1">产品描述</label><textarea name="description" rows={3} className={f} /></div>
          <div>
            <label className="block text-sm mb-1">产品图片（最多 {maxImages} 张）</label>
            {images.map((src, i) => (
              <div key={src} className="inline-block relative mr-2 mb-2">
                <img src={src} className="h-20 rounded border" />
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs">×</button>
              </div>
            ))}
            {images.length < maxImages && <input type="file" accept="image/*" onChange={uploadOne} disabled={uploading} className="block text-sm" />}
          </div>
          <div className="flex gap-3 pt-3">
            <button type="button" onClick={() => setStep(1)} className="border px-4 py-2 rounded text-sm">上一步</button>
            <button type="submit" formAction="draft" className="border px-4 py-2 rounded text-sm">保存草稿</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50">
              {loading ? "提交中..." : "提交审核"}
            </button>
          </div>
          <p className="text-xs text-gray-500">当前会员：{MEMBER_CN[memberLevel]}，最多 {maxImages} 张图</p>
        </form>
      )}
    </div>
  );
}
