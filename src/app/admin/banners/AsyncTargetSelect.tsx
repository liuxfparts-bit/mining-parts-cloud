"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  type: "PRODUCT" | "COMPANY";
  targetId?: number | null;
  initialLabel?: string;
};

export default function AsyncTargetSelect({ type, targetId, initialLabel }: Props) {
  const [q, setQ] = useState(initialLabel || "");
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(targetId || null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim() || selectedId) return;
      const url = type === "PRODUCT" ? `/api/admin/products/search?q=${encodeURIComponent(q)}` : `/api/admin/companies/search?q=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      if (r.ok) setItems(await r.json());
    }, 300);
    return () => clearTimeout(t);
  }, [q, type, selectedId]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setSelectedId(targetId || null);
    setQ(initialLabel || "");
    setItems([]);
  }, [targetId, type]);

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name="targetId" value={selectedId || ""} />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setSelectedId(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={type === "PRODUCT" ? "搜索产品名称 / 件号" : "搜索企业名称"}
        className="border rounded px-3 py-2 text-sm w-full"
      />
      {open && items.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto">
          {items.map((it) => (
            <button
              type="button"
              key={it.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0"
              onClick={() => { setSelectedId(it.id); setQ(it.name + (it.partNumber ? " " + it.partNumber : "")); setOpen(false); }}
            >
              <div className="font-medium">{it.name}</div>
              <div className="text-xs text-gray-500">
                {type === "PRODUCT" ? `${it.partNumber || ""} · ${it.brand || ""} ${it.equipment || ""}` : `${it.province || ""} · ${it.verifiedStatus || ""}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
