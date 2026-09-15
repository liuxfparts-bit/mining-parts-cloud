"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createRFQ } from "@/app/actions";
import { Send, Loader2, X, Upload, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

const initialState = { error: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="bg-accent text-ink hover:bg-[#d49215]">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      {pending ? "发布中..." : "发布询价"}
    </Button>
  );
}

/** 单个 Item 的图片上传（受控组件） */
function ItemImageUploader({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setErr("");
    const list = Array.from(files);
    if (value.length + list.length > 5) {
      setErr("最多上传 5 张");
      return;
    }
    for (const f of list) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        setErr(`文件 ${f.name} 格式不支持，仅 jpg/png/webp`);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setErr(`文件 ${f.name} 超过 5MB`);
        return;
      }
    }
    setUploading(true);
    const done: string[] = [];
    for (const f of list) {
      try {
        const fd = new FormData();
        fd.append("file", f);
        const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
        if (r.status === 401) {
          setErr("登录已失效，即将跳转登录…");
          setTimeout(() => (location.href = "/login?redirect=/rfq/create"), 1500);
          return;
        }
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j.message || "上传失败");
        done.push(j.url);
      } catch (e: any) {
        setErr(e.message || "上传失败，请重试");
      }
    }
    if (done.length) onChange([...value, ...done]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded p-4 text-center cursor-pointer hover:bg-slate-50">
        {uploading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : <Upload className="mx-auto h-5 w-5 text-muted" />}
        <p className="text-sm text-muted mt-1">点击上传图片 / 图纸（jpg/png/webp，单张≤5MB，最多5张）</p>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
        className="hidden" onChange={(e) => onFiles(e.target.files)} />
      {err && <p className="text-red-500 text-xs mt-2">{err}</p>}
      {value.length > 0 && (
        <div className="grid grid-cols-5 gap-2 mt-3">
          {value.map((u, i) => (
            <div key={u} className="relative border rounded p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="w-full h-16 object-cover" />
              <button type="button" onClick={() => remove(i)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs">
                <X className="w-3 h-3 m-auto" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type RFQItemForm = {
  brandName: string;
  equipmentModel: string;
  productName: string;
  partNumber: string;
  quantity: string;
  unit: string;
  description: string;
  images: string[];
};

const emptyItem = (defaultPart?: string): RFQItemForm => ({
  brandName: "",
  equipmentModel: "",
  productName: "",
  partNumber: defaultPart || "",
  quantity: "1",
  unit: "pcs",
  description: "",
  images: [],
});

export default function RFQForm({ defaultPart }: { defaultPart?: string }) {
  const [state, formAction] = useFormState(createRFQ, initialState);
  const [items, setItems] = useState<RFQItemForm[]>([emptyItem(defaultPart)]);

  function update(i: number, patch: Partial<RFQItemForm>) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function addItem() {
    if (items.length >= 50) return;
    setItems([...items, emptyItem()]);
  }

  function removeItem(i: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== i));
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-8 space-y-6">
      {/* 采购标题 */}
      <div>
        <h3 className="text-sm font-bold text-muted mb-3 uppercase tracking-wide">询价单信息</h3>
        <div>
          <label className="block text-xs font-bold mb-1">采购标题 *</label>
          <Input name="title" required placeholder="例如：Sandvik LS190 液压泵及配件采购" />
          <p className="text-xs text-muted mt-1">一条询价单可包含多个采购明细，供应商将逐项报价</p>
        </div>
      </div>

      {/* 采购明细（多 Item） */}
      <div>
        <h3 className="text-sm font-bold text-muted mb-3 uppercase tracking-wide">采购需求（可添加多条明细）</h3>
        <div className="space-y-4">
          {items.map((it, i) => (
            <div key={i} className="border border-line rounded-lg p-4 relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold bg-slate-100 rounded px-2 py-0.5">Item {i + 1}</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)}
                    className="text-red-500 text-xs flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> 删除该明细
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1">品牌</label>
                  <Input value={it.brandName} placeholder="Sandvik / CAT / JOY"
                    onChange={(e) => update(i, { brandName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">设备型号</label>
                  <Input value={it.equipmentModel} placeholder="LS190 / CL210 / 10SC32"
                    onChange={(e) => update(i, { equipmentModel: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">配件名称 *</label>
                  <Input value={it.productName} placeholder="例如：主液压泵"
                    onChange={(e) => update(i, { productName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">件号</label>
                  <Input value={it.partNumber} placeholder="例如 100256099" className="font-mono"
                    onChange={(e) => update(i, { partNumber: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">数量 *</label>
                  <Input value={it.quantity} type="number" min="1"
                    onChange={(e) => update(i, { quantity: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">单位</label>
                  <select value={it.unit}
                    onChange={(e) => update(i, { unit: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-[#dce2e6] bg-white px-3 py-2 text-sm">
                    <option value="pcs">件 / PCS</option>
                    <option value="set">套 / SET</option>
                    <option value="kg">公斤 / KG</option>
                    <option value="m">米 / M</option>
                    <option value="unit">台 / UNIT</option>
                    <option value="lot">批 / LOT</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold mb-1">产品描述</label>
                  <textarea
                    value={it.description}
                    rows={2}
                    placeholder="规格、材质、替代要求等（选填）"
                    onChange={(e) => update(i, { description: e.target.value })}
                    className="flex min-h-[60px] w-full rounded-md border border-[#dce2e6] bg-white px-3 py-2 text-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold mb-1">产品图片 / 图纸（选填）</label>
                  <ItemImageUploader value={it.images} onChange={(v) => update(i, { images: v })} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addItem}
          className="mt-3 w-full border-2 border-dashed border-[#dce2e6] rounded-lg py-3 text-sm text-muted hover:bg-slate-50 flex items-center justify-center gap-1">
          <Plus className="w-4 h-4" /> 添加采购明细
        </button>
      </div>

      {/* 隐藏提交 items */}
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      {/* 物流条款 */}
      <div>
        <h3 className="text-sm font-bold text-muted mb-3 uppercase tracking-wide">物流条款</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1">期望交货日期</label>
            <Input name="deliveryDate" type="date" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">交货地点</label>
            <Input name="deliveryLocation" placeholder="例如：山西朔州" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">贸易条款</label>
            <select name="incoterm" className="flex h-10 w-full rounded-md border border-[#dce2e6] bg-white px-3 py-2 text-sm">
              <option value="">选择贸易条款</option>
              <option value="EXW">EXW 工厂交货</option>
              <option value="FOB">FOB 船上交货</option>
              <option value="CIF">CIF 成本+保险+运费</option>
              <option value="DDP">DDP 完税后交货</option>
            </select>
          </div>
        </div>
      </div>

      {/* 联系方式 */}
      <div>
        <h3 className="text-sm font-bold text-muted mb-3 uppercase tracking-wide">联系方式</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1">联系人 *</label>
            <Input name="contactName" required placeholder="姓名" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">电话 *</label>
            <Input name="contactPhone" required placeholder="手机 / 座机" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">Email</label>
            <Input name="contactEmail" type="email" placeholder="your@email.com" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">WhatsApp</label>
            <Input name="whatsapp" placeholder="+86 ..." />
          </div>
        </div>
      </div>

      {state.error && (
        <p className="text-red-500 text-sm">{state.error}</p>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={() => history.back()}>取消</Button>
        <SubmitButton />
      </div>
    </form>
  );
}
