"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function send(payload: Record<string, unknown>) {
  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || ["/admin", "/dashboard", "/supplier", "/api"].some((p) => pathname.startsWith(p))) return;
    const query = searchParams.toString();
    const url = query ? `${location.origin}${pathname}?${query}` : `${location.origin}${pathname}`;
    send({ eventType: "PAGE_VIEW", path: pathname, url, referrer: document.referrer });

    const fromSearch = searchParams.get("fromSearch");
    if (fromSearch) {
      send({ eventType: "SEARCH", path: "/search", url, referrer: document.referrer, searchQuery: fromSearch, resultCount: 1, metadata: { exactMatch: true } });
    }
  }, [pathname, searchParams]);

  return null;
}

export function SearchAnalytics({ query, resultCount }: { query: string; resultCount: number }) {
  useEffect(() => {
    if (!query) return;
    send({ eventType: "SEARCH", path: "/search", url: location.href, referrer: document.referrer, searchQuery: query, resultCount });
  }, [query, resultCount]);
  return null;
}
