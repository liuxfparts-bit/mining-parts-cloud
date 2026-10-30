"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export default function HomeSearch() {
  const [mode, setMode] = useState("parts");
  return <form action={mode === "equipment" ? "/equipment" : "/search"} method="get" className="home-search-form" role="search">
    <select className="home-search-kind" aria-label="查找方式" value={mode} onChange={event => setMode(event.target.value)}><option value="parts">零件号</option><option value="equipment">设备型号</option><option value="keywords">关键词</option></select>
    <input id="home-query" name="q" required aria-label="搜索零件号、设备型号或关键词" placeholder={mode === "equipment" ? "请输入设备型号，例如 LS190、10SC32、MB670" : "请输入零件号、设备型号或关键词，例如 04694563"} autoComplete="off" />
    <button type="submit" aria-label="搜索配件"><Search size={23} /></button>
  </form>;
}
