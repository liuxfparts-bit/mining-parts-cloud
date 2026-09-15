"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, RotateCcw } from "lucide-react";

type FilterValues = {
  name: string;
  brand: string;
  part: string;
  partNumber: string;
};

export default function SupplierFilter({ initial }: { initial: FilterValues }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [brand, setBrand] = useState(initial.brand);
  const [part, setPart] = useState(initial.part);
  const [partNumber, setPartNumber] = useState(initial.partNumber);

  const buildParams = (page: string) => {
    const p = new URLSearchParams();
    if (name.trim()) p.set("name", name.trim());
    if (brand.trim()) p.set("brand", brand.trim());
    if (part.trim()) p.set("part", part.trim());
    if (partNumber.trim()) p.set("partNumber", partNumber.trim());
    p.set("page", page);
    return p.toString();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 搜索后自动回到第 1 页
    router.push(`/suppliers?${buildParams("1")}`);
  };

  const onReset = () => {
    setName("");
    setBrand("");
    setPart("");
    setPartNumber("");
    router.push("/suppliers");
  };

  const inputCls =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40 bg-white";

  return (
    <form onSubmit={onSubmit} className="bg-white border border-line rounded-lg p-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">厂家名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="搜索厂家名称"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">品牌</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="搜索品牌"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">配件名称</label>
          <input
            type="text"
            value={part}
            onChange={(e) => setPart(e.target.value)}
            placeholder="搜索配件名称"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">件号</label>
          <input
            type="text"
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            placeholder="搜索件号"
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 bg-brandGreen text-white text-sm font-medium px-5 py-2 rounded-md hover:bg-brandGreen/90"
        >
          <Search className="h-4 w-4" />
          搜索
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 border border-line text-sm px-5 py-2 rounded-md hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          重置
        </button>
      </div>
    </form>
  );
}
