"use client";

import { useRouter } from "next/navigation";

export default function PartRFQButton({
  partNumber,
  supplierName,
}: {
  partNumber: string;
  supplierName: string;
}) {
  const router = useRouter();

  function handleClick() {
    const params = new URLSearchParams({
      part: partNumber,
      supplier: supplierName,
    });
    router.push(`/rfq/new?${params.toString()}`);
  }

  return (
    <button
      onClick={handleClick}
      className="bg-accent text-ink text-xs font-bold px-4 py-2 rounded-md hover:bg-[#d49215]"
    >
      向此厂家询价
    </button>
  );
}
