import Link from "next/link";
import { Badge } from "./ui/badge";

interface ProductCardProps {
  id: number;
  partNumber: string;
  productName: string;
  supplierName: string;
  supplierSlug: string;
  price?: number | null;
  productType?: string;
  leadTime?: string | null;
  stock?: number | null;
  stockStatus?: string;
  warranty?: string | null;
  moq?: number | null;
}

const typeBadgeMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "success" }> = {
  OEM: { label: "OEM 原厂", variant: "default" },
  Replacement: { label: "替代件", variant: "secondary" },
  Aftermarket: { label: "售后件", variant: "outline" },
  Used: { label: "二手", variant: "outline" },
  Reconditioned: { label: "再制造", variant: "secondary" },
};

const stockBadgeMap: Record<string, { label: string; className: string }> = {
  IN_STOCK: { label: "现货", className: "text-green" },
  LOW_STOCK: { label: "库存紧张", className: "text-accent" },
  OUT_OF_STOCK: { label: "无货", className: "text-red-500" },
  MADE_TO_ORDER: { label: "按单生产", className: "text-muted" },
};

export default function ProductCard({
  id,
  partNumber,
  productName,
  supplierName,
  supplierSlug,
  price,
  productType,
  leadTime,
  stock,
  stockStatus,
  warranty,
  moq,
}: ProductCardProps) {
  const typeBadge = productType ? typeBadgeMap[productType] : null;
  const stockBadge = stockStatus ? stockBadgeMap[stockStatus] : null;

  return (
    <div className="bg-white border border-line rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2 gap-2">
        <span className="font-mono font-bold text-accent text-sm">{partNumber}</span>
        {typeBadge && <Badge variant={typeBadge.variant}>{typeBadge.label}</Badge>}
      </div>
      <h4 className="text-sm font-medium">{productName}</h4>
      <Link
        href={`/suppliers/${supplierSlug}`}
        className="text-xs text-muted hover:text-accent mt-1 inline-block"
      >
        {supplierName}
      </Link>
      <div className="flex items-center justify-between mt-3">
        {price !== null && price !== undefined ? (
          <span className="text-lg font-bold text-green">¥{price.toLocaleString()}</span>
        ) : (
          <span className="text-sm text-muted">询价</span>
        )}
        {leadTime && <span className="text-xs text-muted">{leadTime}</span>}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs">
        {stockBadge && <span className={stockBadge.className}>{stockBadge.label}</span>}
        {stock !== null && stock !== undefined && stockBadge?.label === "现货" && (
          <span className="text-muted">库存 {stock}</span>
        )}
        {moq && moq > 1 && <span className="text-muted">MOQ {moq}</span>}
      </div>
      {warranty && <p className="text-xs text-muted mt-1">质保：{warranty}</p>}
    </div>
  );
}
