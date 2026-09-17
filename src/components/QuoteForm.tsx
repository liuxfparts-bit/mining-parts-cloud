"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, X, Upload, FileText } from "lucide-react";

export type QuoteItemT = {
  id: number;
  seq: number;
  brandName: string | null;
  equipmentModel: string | null;
  productName: string | null;
  partNumberStr: string | null;
  quantity: number;
  unit: string;
  description: string | null;
  partNumber: { number: string; slug: string } | null;
};

export type ExistingQuoteT = {
  id: number;
  quotedCount: number;
  attachments: string | null;
  items: {
    rfqItemId: number;
    unitPrice: number | null;
    currency: string;
    leadTime: string | null;
    quality: string | null;
    quantity: number | null;
    remarks: string | null;
  }[];
} | null;

type RowState = {
  rfqItemId: number;
  enabled: boolean;
  unitPrice: string;
  currency: string;
  leadTime: string;
  quality: string;
  remarks: string;
};

const CURRENCIES = ["CNY", "USD", "EUR", "INR", "RUB", "ZAR"];
const QUALITIES = ["OEM", "OEM_COMPATIBLE", "AFTERMARKET", "REPLACEMENT", "OTHER"];

const QUALITY_LABEL: Record<string, string> = {
  OEM: "OEM 原厂",
  OEM_COMPATIBLE: "OEM 兼容",
  AFTERMARKET: "Aftermarket 副厂",
  REPLACEMENT: "Replacement 替换",
  OTHER: "Other 其他",
};

const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx";

export default function QuoteForm({
  rfqId,
  supplierId,
  items,
  existing,
  invitationToken,
  successRedirect,
}: {
  rfqId: number;
  supplierId: number;
  items: QuoteItemT[];
  existing: ExistingQuoteT;
  invitationToken?: string;
  /** 提交成功后跳转地址；缺省跳回前台 RFQ 详情（保持原有行为） */
  successRedirect?: string;
}) {
  const [rows, setRows] = useState<RowState[]>(() =>
    items.map((it) => {
      const prev = existing?.items.find((q) => q.rfqItemId === it.id);
      return {
        rfqItemId: it.id,
        enabled: !!prev && prev.unitPrice !== null && prev.unitPrice !== undefined,
        unitPrice: prev?.unitPrice != null ? String(prev.unitPrice) : "",
        currency: prev?.currency || "CNY",
        leadTime: prev?.leadTime || "",
        quality: prev?.quality || "AFTERMARKET",
        remarks: prev?.remarks || "",
      };
    })
  );

  const [attachments, setAttachments] = useState<string[]>(() => {
    if (!existing?.attachments) return [];
    try {
      const v = JSON.parse(existing.attachments);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function update(i: number, patch: Partial<RowState>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function onUpload(files: FileList | null) {
    if (!files) return;
    setErr("");
    const f = files[0];
    const isDoc = !f.type.startsWith("image/");
    if (f.size > (isDoc ? 10 * 1024 * 1024 : 5 * 1024 * 1024)) {
      setErr(isDoc ? "文档不超过 10MB" : "图片不超过 5MB");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("scope", "quote");
      const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      if (r.status === 401) {
        setErr("登录已失效，即将跳转登录…");
        setTimeout(() => (location.href = "/login?redirect=/rfq/" + rfqId + "/quote"), 1500);
        return;
      }
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.message || "上传失败");
      setAttachments([...attachments, j.url]);
    } catch (e: any) {
      setErr(e.message || "附件上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    setErr("");
    const enabled = rows.filter((r) => r.enabled);
    if (enabled.length === 0) {
      setErr("请至少对一项明细报价（勾选“是否报价”并填写单价）");
      return;
    }
    for (const r of enabled) {
      const price = parseFloat(r.unitPrice);
      if (isNaN(price) || price <= 0) {
        const it = items.find((x) => x.id === r.rfqItemId);
        setErr(`Item ${it?.seq ?? ""}（${it?.partNumberStr || it?.productName || ""}）单价无效`);
        return;
      }
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("rfqId", String(rfqId));
      fd.append("supplierId", String(supplierId));
      fd.append(
        "items",
        JSON.stringify(
          enabled.map((r) => ({
            rfqItemId: r.rfqItemId,
            unitPrice: parseFloat(r.unitPrice),
            currency: r.currency,
            leadTime: r.leadTime || null,
            quality: r.quality || null,
            remarks: r.remarks || null,
          }))
        )
      );
      fd.append("attachments", JSON.stringify(attachments));
      if (invitationToken) fd.append("invitationToken", invitationToken);
      const res = await fetch("/api/quote", { method: "POST", body: fd, credentials: "include" });
      if (res.status === 401) {
        setErr("登录已失效，即将跳转登录…");
        setTimeout(() => (location.href = "/login?redirect=/rfq/" + rfqId + "/quote"), 1500);
        return;
      }
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "提交失败");
      window.location.href = successRedirect || `/rfq/${rfqId}`;
    } catch (e: any) {
      setErr(e.message || "提交失败，请重试");
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-line rounded-lg p-6 md:p-8">
      {/* 附件 */}
      <div className="mb-5">
        <label className="block text-xs font-bold mb-2">报价附件（选填：正式 Quotation / PDF / Excel / Word / 图片）</label>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-[#dce2e6] rounded-lg px-4 py-2 text-sm text-muted hover:bg-slate-50 flex items-center gap-1">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            添加附件
          </button>
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
            onChange={(e) => onUpload(e.target.files)} />
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {attachments.map((u, i) => (
              <div key={u} className="flex items-center gap-1 border rounded px-2 py-1 text-xs bg-slate-50">
                <FileText className="w-3 h-3 text-muted" />
                <a href={u} target="_blank" className="text-blue-600 hover:underline max-w-[180px] truncate">{u.split("/").pop()}</a>
                <button type="button" onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                  className="text-red-500"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 逐项报价 */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm min-w-[760px] border-collapse">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-line">
              <th className="py-2 pr-2">明细</th>
              <th className="py-2 px-2">件号 / 品牌 / 型号</th>
              <th className="py-2 px-2 text-center">数量</th>
              <th className="py-2 px-2 text-center">报价</th>
              <th className="py-2 px-2">单价</th>
              <th className="py-2 px-2">币种</th>
              <th className="py-2 px-2">交期</th>
              <th className="py-2 px-2">质量等级</th>
              <th className="py-2 pl-2">备注</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const row = rows[i];
              return (
                <tr key={it.id} className="border-b border-line align-top">
                  <td className="py-2 pr-2 whitespace-nowrap">
                    <span className="text-xs font-bold bg-slate-100 rounded px-1.5 py-0.5">Item {it.seq}</span>
                  </td>
                  <td className="py-2 px-2">
                    <div className="font-mono text-xs">{it.partNumberStr || it.partNumber?.number || "—"}</div>
                    <div className="text-xs">{it.productName || ""}</div>
                    <div className="text-xs text-muted">{[it.brandName, it.equipmentModel].filter(Boolean).join(" / ")}</div>
                  </td>
                  <td className="py-2 px-2 text-center whitespace-nowrap">{it.quantity} {it.unit}</td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => update(i, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-amber-500"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      type="number" min="0" step="0.01"
                      disabled={!row.enabled}
                      value={row.unitPrice}
                      onChange={(e) => update(i, { unitPrice: e.target.value })}
                      placeholder="0.00"
                      className="h-9 w-24 text-sm font-mono"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <select
                      disabled={!row.enabled}
                      value={row.currency}
                      onChange={(e) => update(i, { currency: e.target.value })}
                      className="h-9 w-20 rounded-md border border-[#dce2e6] bg-white px-1 text-xs">
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      disabled={!row.enabled}
                      value={row.leadTime}
                      onChange={(e) => update(i, { leadTime: e.target.value })}
                      placeholder="如 15-20天"
                      className="h-9 w-24 text-xs"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <select
                      disabled={!row.enabled}
                      value={row.quality}
                      onChange={(e) => update(i, { quality: e.target.value })}
                      className="h-9 w-36 rounded-md border border-[#dce2e6] bg-white px-1 text-xs">
                      {QUALITIES.map((q) => <option key={q} value={q}>{QUALITY_LABEL[q]}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pl-2">
                    <Input
                      disabled={!row.enabled}
                      value={row.remarks}
                      onChange={(e) => update(i, { remarks: e.target.value })}
                      placeholder="备注"
                      className="h-9 w-28 text-xs"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {err && <p className="text-red-500 text-sm mb-3">{err}</p>}

      <div className="flex justify-end gap-3 pt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={() => history.back()}>取消</Button>
        <Button type="button" disabled={busy} onClick={submit}
          className="bg-accent text-ink hover:bg-[#d49215]">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {existing ? "更新报价" : "提交报价"}
        </Button>
      </div>
    </div>
  );
}
