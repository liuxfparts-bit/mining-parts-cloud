"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export default function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form
      onSubmit={handleSearch}
      className={`bg-white rounded-lg p-[7px] flex shadow-[0_12px_35px_rgba(0,0,0,0.3)] ${className}`}
    >
      <div className="flex items-center flex-1 px-3">
        <Search className="h-5 w-5 text-muted mr-2" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="输入品牌、设备型号、配件件号，例如 XP210162 / Sandvik MB670-1"
          className="flex-1 border-0 outline-0 py-3 text-[15px] text-ink bg-transparent"
        />
      </div>
      <button
        type="submit"
        className="bg-accent text-ink font-bold px-6 py-3 rounded-md hover:bg-[#d49215] transition-colors whitespace-nowrap"
      >
        搜索
      </button>
    </form>
  );
}
