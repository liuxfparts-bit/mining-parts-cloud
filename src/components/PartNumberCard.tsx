import Link from "next/link";
import { Badge } from "./ui/badge";

interface PartNumberCardProps {
  slug: string;
  partNumber: string;
  name: string;
  category: string;
  brandName?: string | null;
  equipmentModel?: string | null;
  supplierCount: number;
  minPrice?: number | null;
}

export default function PartNumberCard({
  slug,
  partNumber,
  name,
  category,
  brandName,
  equipmentModel,
  supplierCount,
  minPrice,
}: PartNumberCardProps) {
  return (
    <div className="bg-white border border-line rounded-lg p-5 hover:shadow-md transition-shadow">
      <Link href={`/part-number/${slug}`}>
        <span className="font-mono text-lg font-bold text-accent hover:underline">
          {partNumber}
        </span>
      </Link>
      <p className="text-sm text-ink mt-1">{name}</p>
      <div className="flex gap-2 mt-2 flex-wrap">
        <Badge variant="secondary">{category}</Badge>
        {brandName && <Badge>{brandName}</Badge>}
        {equipmentModel && (
          <Badge variant="outline">{equipmentModel}</Badge>
        )}
      </div>
      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-muted">{supplierCount} 家可供货</span>
        {minPrice !== null && minPrice !== undefined && (
          <span className="text-sm font-bold text-green">¥{minPrice.toLocaleString()} 起</span>
        )}
      </div>
    </div>
  );
}
