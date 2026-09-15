"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createRFQ } from "@/app/actions";
import { Send, Loader2, X, Upload, Plus, Trash2, FileSpreadsheet, AlertTriangle, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  loadWorkbook,
  parseWorkbook,
  parseSheet,
  getHeaderCells,
  type FieldMapping,
  type ParsedRow,
  type SheetMeta,
} from "@/lib/excel";

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

  // ===== Excel 批量导入 =====
  const [excel, setExcel] = useState<{
    wb: XLSX.WorkBook;
    sheets: SheetMeta[];
    sel: string;
    headerRow: number;
    mapping: FieldMapping;
    parsed: ParsedRow[];
    fileName: string;
  } | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [excelErr, setExcelErr] = useState("");

  function reparse(s: typeof excel) {
    if (!s) return;
    const parsed = parseSheet(s.wb, s.sel, s.headerRow, s.mapping);
    setExcel({ ...s, parsed });
  }

  async function onExcelFile(file: File) {
    setExcelErr("");
    try {
      const buf = await file.arrayBuffer();
      const wb = loadWorkbook(buf);
      const meta = parseWorkbook(wb);
      if (meta.sheets.length === 0) {
        setExcelErr("无法读取该文件，请确认是 .xlsx / .xls / .csv 格式");
        return;
      }
      const sel = meta.defaultSheet;
      const def = meta.sheets.find((s) => s.name === sel) || meta.sheets[0];
      const s = {
        wb,
        sheets: meta.sheets,
        sel: def.name,
        headerRow: def.headerRow,
        mapping: def.mapping,
        parsed: [] as ParsedRow[],
        fileName: file.name,
      };
      s.parsed = parseSheet(s.wb, s.sel, s.headerRow, s.mapping);
      setExcel(s);
    } catch (e: any) {
      console.error("【Excel 解析失败】:", e);
      setExcelErr("Excel 解析失败：" + (e?.message || "文件格式不支持"));
    }
  }

  function confirmImport() {
    if (!excel) return;
    const validRows = excel.parsed.filter(
      (r) =>
        r.partNumber !== "" ||
        r.productName !== "" ||
        r.brandName !== "" ||
        r.equipmentModel !== ""
    );
    const newItems: RFQItemForm[] = validRows.map((r) => ({
      brandName: r.brandName,
      equipmentModel: r.equipmentModel,
      productName: r.productName,
      partNumber: r.partNumber,
      quantity: r.quantity && r.quantity > 0 ? String(r.quantity) : "1",
      unit: r.unit || "pcs",
      description: r.description,
      images: [],
    }));
    const merged = [...items, ...newItems].slice(0, 50);
    setItems(merged);
    setExcel(null);
    if (excelInputRef.current) excelInputRef.current.value = "";
    if (newItems.length + items.length > 50) {
      setExcelErr("最多 50 条明细，已截断超出部分");
    } else {
      setExcelErr("");
    }
  }

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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-muted uppercase tracking-wide">采购需求（可添加多条明细）</h3>
          <div>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onExcelFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => excelInputRef.current?.click()}
              className="text-xs flex items-center gap-1 text-blue-600 border border-blue-200 bg-blue-50 rounded px-2.5 py-1.5 hover:bg-blue-100">
              <FileSpreadsheet className="w-3.5 h-3.5" /> 批量导入 Excel
            </button>
          </div>
        </div>

        {/* Excel 导入面板 */}
        {excel && (
          <div className="border-2 border-blue-200 rounded-lg p-4 mb-4 bg-blue-50/40">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-blue-700">Excel 导入预览：{excel.fileName}</h4>
              <button type="button" onClick={() => { setExcel(null); setExcelErr(""); }}
                className="text-xs text-muted hover:text-red-500">关闭</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-bold mb-1">Sheet</label>
                <select
                  value={excel.sel}
                  onChange={(e) => {
                    const ns = { ...excel, sel: e.target.value };
                    const meta = excel.sheets.find((s) => s.name === e.target.value);
                    if (meta) { ns.headerRow = meta.headerRow; ns.mapping = meta.mapping; }
                    reparse(ns);
                  }}
                  className="flex h-9 w-full rounded-md border border-[#dce2e6] bg-white px-2 py-1 text-sm">
                  {excel.sheets.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}（表头第 {s.headerRow} 行，命中 {s.confidence} 字段）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">表头行</label>
                <div className="flex items-center gap-1">
                  <button type="button"
                    onClick={() => reparse({ ...excel, headerRow: Math.max(1, excel.headerRow - 1) })}
                    className="border rounded px-2 h-9 bg-white">-</button>
                  <Input
                    type="number" min={1}
                    value={excel.headerRow}
                    onChange={(e) => reparse({ ...excel, headerRow: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="h-9 text-center w-16" />
                  <button type="button"
                    onClick={() => reparse({ ...excel, headerRow: excel.headerRow + 1 })}
                    className="border rounded px-2 h-9 bg-white">+</button>
                </div>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold mb-1">已识别 {excel.parsed.length} 行，错误 {excel.parsed.filter((r) => r.errors.length).length} 行</label>
                <div className="text-xs text-muted">预览可直接调整，确认后填入下方明细</div>
              </div>
            </div>

            {/* 列映射 */}
            <div className="mb-3">
              <label className="block text-xs font-bold mb-1">字段映射（自动识别，可手动修正）</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(
                  [
                    ["brandName", "品牌"],
                    ["equipmentModel", "设备型号"],
                    ["productName", "配件名称"],
                    ["partNumber", "件号"],
                    ["quantity", "数量"],
                    ["unit", "单位"],
                    ["description", "描述"],
                  ] as [keyof FieldMapping, string][]
                ).map(([field, label]) => {
                  const cols = getHeaderCells(excel.wb, excel.sel, excel.headerRow);
                  return (
                    <div key={field}>
                      <label className="block text-[10px] text-muted mb-0.5">{label}</label>
                      <select
                        value={excel.mapping[field] === undefined ? -1 : excel.mapping[field]}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          const mapping = { ...excel.mapping };
                          if (v === -1) delete mapping[field];
                          else mapping[field] = v;
                          reparse({ ...excel, mapping });
                        }}
                        className="flex h-8 w-full rounded-md border border-[#dce2e6] bg-white px-1.5 text-xs">
                        <option value={-1}>— 未识别 —</option>
                        {cols.map((c, ci) => (
                          <option key={ci} value={ci}>列{ci + 1}: {c}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 错误提示 */}
            {(() => {
              const errs = excel.parsed.flatMap((r) => r.errors.map((e) => `${r.rowNum} 行：${e}`));
              return errs.length > 0 ? (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-700 space-y-0.5 max-h-24 overflow-auto">
                  <p className="font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> 以下行需要关注（可导入后手动修正）：</p>
                  {errs.slice(0, 20).map((e, i) => <p key={i}>{e}</p>)}
                  {errs.length > 20 && <p>…共 {errs.length} 条</p>}
                </div>
              ) : null;
            })()}

            {/* 预览表格 */}
            <div className="overflow-x-auto bg-white border rounded-lg mb-3 max-h-72 overflow-y-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">品牌</th>
                    <th className="p-2 text-left">设备型号</th>
                    <th className="p-2 text-left">配件名称</th>
                    <th className="p-2 text-left">件号</th>
                    <th className="p-2 text-left">数量</th>
                    <th className="p-2 text-left">单位</th>
                    <th className="p-2 text-left">描述</th>
                  </tr>
                </thead>
                <tbody>
                  {excel.parsed.map((r) => (
                    <tr key={r.rowNum} className={r.errors.length ? "bg-red-50" : "border-t"}>
                      <td className="p-2">{r.rowNum}</td>
                      <td className="p-2">{r.brandName}</td>
                      <td className="p-2">{r.equipmentModel}</td>
                      <td className="p-2">{r.productName}</td>
                      <td className="p-2 font-mono">{r.partNumber}</td>
                      <td className="p-2">{r.quantity ?? <span className="text-red-500">—</span>}</td>
                      <td className="p-2">{r.unit}</td>
                      <td className="p-2 text-muted max-w-[140px] truncate">{r.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm"
                onClick={() => { setExcel(null); setExcelErr(""); }}>取消</Button>
              <Button type="button" size="sm" className="bg-accent text-ink"
                onClick={confirmImport}>
                确认导入 {excel.parsed.length} 条到明细
              </Button>
            </div>
          </div>
        )}

        {excelErr && <p className="text-red-500 text-xs mb-3">{excelErr}</p>}

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
