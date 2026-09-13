"use client";

export default function BrandsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container py-[80px] text-center">
      <h1 className="text-2xl font-bold mb-3">品牌数据加载失败</h1>
      <p className="text-muted mb-6">请刷新重试，或稍后再访问。</p>
      <button onClick={() => reset()} className="bg-amber-500 text-white px-5 py-2 rounded">重新加载</button>
    </div>
  );
}
