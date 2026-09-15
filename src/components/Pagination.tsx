import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  baseQuery: URLSearchParams;
}

export default function Pagination({ page, totalPages, total, pageSize, baseQuery }: PaginationProps) {
  if (total === 0) return null;

  const q = (p: number) => {
    const sp = new URLSearchParams(baseQuery.toString());
    sp.set("page", String(p));
    sp.set("pageSize", String(pageSize));
    return `?${sp.toString()}`;
  };

  const qSize = (s: number) => {
    const sp = new URLSearchParams(baseQuery.toString());
    sp.set("page", "1");
    sp.set("pageSize", String(s));
    return `?${sp.toString()}`;
  };

  // 页码（最多 7 个，含省略号）
  const pageItems: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageItems.push(i);
  } else {
    pageItems.push(1);
    if (page > 3) pageItems.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pageItems.push(i);
    if (page < totalPages - 2) pageItems.push("…");
    pageItems.push(totalPages);
  }

  const pageBtn =
    "min-w-[40px] h-9 px-3 inline-flex items-center justify-center text-sm rounded-md border border-line hover:bg-gray-50";
  const pageBtnActive = "min-w-[40px] h-9 px-3 inline-flex items-center justify-center text-sm rounded-md bg-brandGreen text-white font-medium";
  const sizes = [20, 50, 100];

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mt-8">
      <span className="text-xs text-muted">
        共 {total} 条，第 {page} / {totalPages} 页
      </span>
      <nav className="flex items-center gap-1.5 flex-wrap justify-center">
        {page > 1 && (
          <Link href={q(page - 1)} className={pageBtn}>
            <ChevronLeft className="h-4 w-4 mr-0.5" />
            上一页
          </Link>
        )}
        {pageItems.map((it, idx) =>
          it === "…" ? (
            <span key={`e${idx}`} className="px-1 text-muted text-sm">…</span>
          ) : (
            <Link key={it} href={q(it)} className={it === page ? pageBtnActive : pageBtn}>
              {it}
            </Link>
          )
        )}
        {page < totalPages && (
          <Link href={q(page + 1)} className={pageBtn}>
            下一页
            <ChevronRight className="h-4 w-4 ml-0.5" />
          </Link>
        )}
      </nav>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted mr-1">每页</span>
        {sizes.map((s) => (
          <Link
            key={s}
            href={qSize(s)}
            className={`min-w-[40px] h-8 px-2.5 inline-flex items-center justify-center rounded-md text-sm ${
              s === pageSize ? "bg-brandGreen text-white font-medium" : "border border-line hover:bg-gray-50"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>
    </div>
  );
}
