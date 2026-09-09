"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomeSearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  }

  return (
    <form onSubmit={handleSearch} className="bg-white rounded-lg p-[7px] flex max-w-[920px] shadow-[0_12px_35px_rgba(0,0,0,0.3)]">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="请输入品牌、设备型号、配件件号或产品名称，例如 XP210162 / Sandvik LS190"
        className="flex-1 border-0 outline-0 px-4 py-4 text-[15px] text-ink"
      />
      <button
        type="submit"
        className="min-w-[110px] bg-accent text-ink font-bold px-6 py-3 rounded-md hover:bg-[#d49215] transition-colors"
      >
        搜索
      </button>
    </form>
  );
}
