import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface EquipmentCardProps {
  slug: string;
  brandName: string;
  model: string;
  equipmentType: string;
  description?: string | null;
  partCount: number;
  imageUrl?: string | null;
}

export default function EquipmentCard({
  slug,
  brandName,
  model,
  equipmentType,
  description,
  partCount,
  imageUrl,
}: EquipmentCardProps) {
  return (
    <Link
      href={`/equipment/${slug}`}
      className="bg-white border border-line rounded-lg overflow-hidden hover:shadow-md transition-shadow block group"
    >
      <div className="h-[125px] bg-gradient-to-br from-[#35444c] to-[#17222a] flex items-end p-4 text-white font-bold relative overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={`${brandName} ${model}`} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="relative">{brandName} {model}</span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-base font-bold mb-1 group-hover:text-accent transition-colors">
          {brandName} {model}
        </h3>
        <p className="text-xs text-muted mb-2">{equipmentType}</p>
        {description && (
          <p className="text-xs text-muted line-clamp-2">{description}</p>
        )}
        <div className="flex items-center justify-between mt-3">
          <span className="inline-block bg-[#f2f4f5] px-2 py-1 rounded text-[11px]">
            件号 {partCount}
          </span>
          <span className="text-accent text-xs flex items-center">
            查看 <ChevronRight className="h-3 w-3 ml-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
