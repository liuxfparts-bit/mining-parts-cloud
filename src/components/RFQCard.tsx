import Link from "next/link";
import { Badge } from "./ui/badge";
import { MapPin, Package, ListChecks, Factory } from "lucide-react";

interface RFQCardProps {
  id: number;
  rfqNo?: string | null;
  title: string;
  partNumberStr?: string | null;
  brandName?: string | null;
  quantity: number;
  itemCount?: number;
  quoteCount?: number;
  region?: string | null;
  status: string;
  createdAt: Date;
}

const statusMap: Record<string, { label: string; variant: "success" | "secondary" | "outline" | "destructive" }> = {
  COLLECTING: { label: "待报价", variant: "success" },
  QUOTED: { label: "报价中", variant: "secondary" },
  SELECTED: { label: "已选定", variant: "secondary" },
  CLOSED: { label: "已关闭", variant: "outline" },
  EXPIRED: { label: "已截止", variant: "destructive" },
};

export function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(date).toLocaleDateString("zh-CN");
}

export default function RFQCard({
  id,
  rfqNo,
  title,
  partNumberStr,
  brandName,
  quantity,
  itemCount,
  quoteCount,
  region,
  status,
  createdAt,
}: RFQCardProps) {
  const s = statusMap[status] || { label: status, variant: "secondary" as const };

  return (
    <div className="bg-white border border-line rounded-lg p-5 hover:shadow-md transition-shadow flex flex-col">
      <Link href={`/rfq/${id}`} className="block flex-1">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-bold text-sm line-clamp-1 hover:text-accent transition-colors">{title}</h3>
          <Badge variant={s.variant}>{s.label}</Badge>
        </div>

        {rfqNo && <div className="font-mono text-xs text-muted mb-2">{rfqNo}</div>}

        {(brandName || partNumberStr) && (
          <div className="flex gap-2 flex-wrap mb-2">
            {brandName && <Badge variant="secondary">{brandName}</Badge>}
            {partNumberStr && <Badge variant="outline" className="font-mono">{partNumberStr}</Badge>}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted mt-2 flex-wrap">
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" /> 采购量 {quantity} PCS
          </span>
          {itemCount !== undefined && itemCount > 0 && (
            <span className="flex items-center gap-1">
              <ListChecks className="h-3 w-3" /> 采购明细 {itemCount} 项
            </span>
          )}
          {quoteCount !== undefined && quoteCount > 0 && (
            <span className="flex items-center gap-1 text-brandGreen">
              <Factory className="h-3 w-3" /> 已有 {quoteCount} 家报价
            </span>
          )}
          {region && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {region}
            </span>
          )}
        </div>
      </Link>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-line/60 text-xs">
        <span className="text-muted">{timeAgo(createdAt)}</span>
        <div className="flex gap-3">
          <Link href={`/rfq/${id}`} className="text-accent hover:underline font-medium">查看询价</Link>
          <Link href={`/rfq/${id}/quote`} className="text-brandGreen hover:underline font-medium">立即报价</Link>
        </div>
      </div>
    </div>
  );
}
