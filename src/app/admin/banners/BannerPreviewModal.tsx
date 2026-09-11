"use client";

import { useState } from "react";

type Props = {
  banner: { title: string; imageUrl: string; targetType: string; status: string; endAt?: Date | string | null };
};

export default function BannerPreviewModal({ banner }: Props) {
  const [open, setOpen] = useState(false);
  const expired = banner.endAt && new Date(banner.endAt) < new Date();
  const active = banner.status === "ACTIVE" && !expired;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-gray-600">预览</button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">广告预览</h3>
              <button onClick={() => setOpen(false)} className="text-gray-500">✕</button>
            </div>
            <div className="mb-2 flex gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-gray-100">{banner.targetType}</span>
              <span className={`px-2 py-1 rounded ${active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{active ? "生效中" : "已过期/未启用"}</span>
            </div>
            <div className="text-sm mb-2 font-medium">{banner.title}</div>
            <div className="border rounded overflow-hidden">
              <img src={banner.imageUrl} alt={banner.title} className="w-full" />
            </div>
            <div className="text-xs text-gray-500 mt-2">PC 端预览（1440 宽）</div>
          </div>
        </div>
      )}
    </>
  );
}
