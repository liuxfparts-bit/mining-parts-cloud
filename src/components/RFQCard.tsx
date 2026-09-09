import Link from "next/link";
import { Badge } from "./ui/badge";
import { MapPin, Package } from "lucide-react";

interface RFQCardProps {
  id: number;
  title: string;
  partNumberStr?: string | null;
  brandName?: string | null;
  quantity: number;
  region?: string | null;
  status: string;
  createdAt: Date;
}

const statusMap: Record<string, { label: string; variant: "success" | "secondary" | "outline" | "destructive" }> = {
  COLLECTING: { label: "征集中", variant: "success" },
  QUOTED: { label: "已报价", variant: "secondary" },
  SELECTED: { label: "已选定", variant: "secondary" },
  CLOSED: { label: "已关闭", variant: "outline" },
  EXPIRED: { label: "已过期", variant: "destructive" },
};

export default function RFQCard({
  id,
  title,
  partNumberStr,
  brandName,
  quantity,
  region,
  status,
  createdAt,
}: RFQCardProps) {
  const s = statusMap[status] || { label: status, variant: "secondary" as const };

  return (
    <Link
      href={`/rfq/${id}`}
      className="bg-white border border-line rounded-lg p-5 hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold text-sm line-clamp-1">{title}</h3>
        <Badge variant={s.variant}>{s.label}</Badge>
      </div>
      {(brandName || partNumberStr) && (
        <div className="flex gap-2 flex-wrap mb-2">
          {brandName && <Badge variant="secondary">{brandName}</Badge>}
          {partNumberStr && (
            <Badge variant="outline" className="font-mono">{partNumberStr}</Badge>
          )}
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-muted mt-3">
        <span className="flex items-center gap-1">
          <Package className="h-3 w-3" /> {quantity} pcs
        </span>
        {region && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {region}
          </span>
        )}
        <span className="ml-auto">{new Date(createdAt).toLocaleDateString("zh-CN")}</span>
      </div>
    </Link>
  );
}
