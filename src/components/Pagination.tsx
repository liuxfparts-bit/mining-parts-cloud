import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 统一数据库级分页组件（服务端渲染）
 * - 旧调用：page / totalPages / total / pageSize / baseQuery(URLSearchParams)
 * - 新调用：page / totalPages / total / pageSize / makeHref(page, pageSize)
 * - 始终显示总数与当前页/总页数；页码 当前页±1 + 首尾页 + 省略号
 */
interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  baseQuery?: URLSearchParams;
  makeHref?: (page: number, pageSize: number) => string;
  pageSizes?: number[];
  label?: string;
}

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  baseQuery,
  makeHref,
  pageSizes = [10, 20, 50],
  label = "条",
}: PaginationProps) {
  if (total === 0) return null;

  const href = (p: number, ps: number): string => {
    if (makeHref) return makeHref(p, ps);
    const sp = new URLSearchParams((baseQuery as URLSearchParams).toString());
    sp.set("page", String(p));
    sp.set("pageSize", String(ps));
    return `?${sp.toString()}`;
  };

  // 页码（当前页 ±1 + 首尾页 + 省略号）
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
    "min-w-[32px] h-8 px-2.5 inline-flex items-center justify-center text-sm rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300";
  const pageBtnActive =
    "min-w-[32px] h-8 px-2.5 inline-flex items-center justify-center text-sm rounded-lg bg-blue-600 text-white font-medium";
  const navBtn = pageBtn + " gap-0.5";

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span className="font-medium text-slate-700">
          共 {total} {label}
        </span>
        <span>
          · 第 {page} / {totalPages} 页
        </span>
        {pageSizes.length > 1 && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs">
            | 每页
            {pageSizes.map((s) => (
              <Link
                key={s}
                href={href(1, s)}
                className={`px-1.5 rounded ${pageSize === s ? "text-blue-600 font-semibold" : "text-slate-400 hover:text-slate-600"}`}
              >
                {s}
              </Link>
            ))}
          </span>
        )}
      </div>

      <nav className="flex items-center gap-1.5 flex-wrap justify-center">
        {page > 1 ? (
          <Link href={href(page - 1, pageSize)} className={navBtn}>
            <ChevronLeft className="h-3.5 w-3.5" />
            上一页
          </Link>
        ) : (
          <span className={`${navBtn} opacity-40 cursor-not-allowed`}>
            <ChevronLeft className="h-3.5 w-3.5" />
            上一页
          </span>
        )}

        {pageItems.map((it, idx) =>
          it === "…" ? (
            <span key={`e${idx}`} className="px-1 text-slate-400 text-sm">
              …
            </span>
          ) : (
            <Link key={it} href={href(it, pageSize)} className={it === page ? pageBtnActive : pageBtn}>
              {it}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link href={href(page + 1, pageSize)} className={navBtn}>
            下一页
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className={`${navBtn} opacity-40 cursor-not-allowed`}>
            下一页
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </nav>
    </div>
  );
}
