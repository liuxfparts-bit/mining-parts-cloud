import Link from "next/link";

export default function Pagination({ page, totalPages, total, pageSize, baseQuery }: {
  page: number; totalPages: number; total: number; pageSize: number; baseQuery: URLSearchParams;
}) {
  if (total === 0) return null;
  const q = (p: number) => {
    const sp = new URLSearchParams(baseQuery.toString());
    sp.set("page", String(p));
    sp.set("pageSize", String(pageSize));
    return `?${sp.toString()}`;
  };
  return (
    <div className="flex justify-between items-center mt-3 text-sm">
      <span>共 {total} 条，第 {page} / {totalPages} 页</span>
      <div className="flex gap-2">
        <Link href={q(Math.max(1, page - 1))} className="border px-3 py-1 rounded">上一页</Link>
        <Link href={q(Math.min(totalPages, page + 1))} className="border px-3 py-1 rounded">下一页</Link>
      </div>
    </div>
  );
}
