"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";

const modes = [
  { id: "parts", label: "配件号搜索" },
  { id: "equipment", label: "设备型号" },
  { id: "brands", label: "品牌" },
  { id: "keywords", label: "描述关键词" },
  { id: "reverse", label: "智能反查" },
];
const searchPlaceholder = "请输入配件号、设备型号或关键词（例如：MB670-1, LS190, 10SC32）";

export default function HomeSearch() {
  const [active, setActive] = useState(modes[0]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    if (active.id === "reverse") {
      event.preventDefault();
      window.location.href = "/part-number";
    }
  }

  return (
    <div className="home-search-panel">
      <div className="home-search-tabs" role="tablist" aria-label="选择查找方式">
        {modes.map((mode) => <button key={mode.id} type="button" role="tab" aria-selected={active.id === mode.id} className={active.id === mode.id ? "is-active" : ""} onClick={() => setActive(mode)}>{mode.label}</button>)}
      </div>
      <form action="/search" className="home-search-form" onSubmit={submitSearch}>
        <Search className="home-search-icon" size={19} aria-hidden="true" />
        <input name="q" placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
        <button type="submit">{active.id === "reverse" ? "进入反查入口" : "开始查找"}<ArrowRight size={16} /></button>
      </form>
      <div className="home-search-foot"><span>{active.id === "reverse" ? "智能反查入口展示，当前未接入 AI 服务" : "配件号、设备型号或描述关键词搜索"}</span><Link href="/part-number">智能反查入口 <ArrowRight size={13} /></Link></div>
    </div>
  );
}
