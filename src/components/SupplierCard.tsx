import Link from "next/link";
import { Badge } from "./ui/badge";
import { CheckCircle2 } from "lucide-react";

interface SupplierCardProps {
  slug: string;
  name: string;
  shortName?: string | null;
  province?: string | null;
  mainBusiness: string;
  verified: boolean;
  productCount: number;
  memberLevel?: string;
  responseRate?: number | null;
}

const levelLabel: Record<string, string> = {
  GOLD: "金牌",
  SILVER: "银牌",
  BRONZE: "铜牌",
  FREE: "免费",
};

export default function SupplierCard({
  slug,
  name,
  shortName,
  province,
  mainBusiness,
  verified,
  productCount,
  memberLevel,
  responseRate,
}: SupplierCardProps) {
  return (
    <Link
      href={`/suppliers/${slug}`}
      className="bg-white border border-line p-5 rounded-lg hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-md bg-[#eef1f3] flex items-center justify-center font-bold shrink-0">
          {(shortName || name)[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-bold truncate">{shortName || name}</h3>
            {verified && <CheckCircle2 className="h-3.5 w-3.5 text-green shrink-0" />}
          </div>
          <p className="text-xs text-muted mt-0.5">{province || "未知地区"}</p>
        </div>
      </div>
      <p className="text-xs text-muted leading-relaxed mt-3 line-clamp-2">
        主营：{mainBusiness}
      </p>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Badge variant="secondary">{productCount} 个产品</Badge>
        {memberLevel && memberLevel !== "FREE" && (
          <Badge variant="outline">{levelLabel[memberLevel] || memberLevel}</Badge>
        )}
        {responseRate && responseRate >= 80 && (
          <span className="text-xs text-green">回复率 {responseRate}%</span>
        )}
      </div>
    </Link>
  );
}
