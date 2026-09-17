"use client";

import { useState } from "react";

/** 询价图片/图纸缩略图（图片失效自动隐藏，避免破图） */
export default function RfqImages({ urls, size = "md" }: { urls: string[]; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  if (!urls || urls.length === 0) return null;

  const cls = size === "sm" ? "w-14 h-14" : "w-20 h-20";

  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u) => {
        if (!u || failed.has(u)) return null;
        return (
          <a key={u} href={u} target="_blank" rel="noreferrer" title="查看原图" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u}
              alt=""
              loading="lazy"
              onError={() => setFailed((s) => new Set(s).add(u))}
              className={`${cls} object-cover rounded-lg border border-slate-200 bg-slate-50`}
            />
          </a>
        );
      })}
    </div>
  );
}
