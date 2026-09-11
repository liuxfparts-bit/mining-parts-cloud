"use client";

import { useEffect, useRef, useState } from "react";

type Brand = { id: number; name: string; nameEn?: string | null };

export default function SearchableBrandSelect({ brands, value, onChange, name }: { brands: Brand[]; value: number | ""; onChange: (id: number) => void; name?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = brands.find((b) => b.id === value);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = brands.filter((b) => !q || b.name.toLowerCase().includes(q.toLowerCase()) || (b.nameEn || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={value} />
      <button type="button" onClick={() => setOpen(!open)} className="border rounded px-3 py-2 text-sm w-full text-left bg-white">
        {selected ? selected.name : "选择品牌"}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow-lg">
          <input autoFocus placeholder="搜索品牌…" value={q} onChange={(e) => setQ(e.target.value)} className="border-b px-3 py-2 text-sm w-full" />
          <div className="max-h-48 overflow-auto">
            {filtered.length === 0 ? <div className="p-3 text-xs text-gray-400">无匹配</div> :
              filtered.map((b) => (
                <div key={b.id} onClick={() => { onChange(b.id); setOpen(false); setQ(""); }} className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                  {b.name}{b.nameEn && <span className="text-gray-400 ml-2">{b.nameEn}</span>}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
