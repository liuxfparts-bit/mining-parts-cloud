import { Suspense } from "react";
import RFQForm from "@/components/RFQForm";

export default function NewRFQPage({
  searchParams,
}: {
  searchParams: {
    partNumber?: string;
    brandName?: string;
    equipmentModel?: string;
    productName?: string;
    supplierId?: string;
  };
}) {
  return (
    <div className="container py-[42px]">
      <div className="max-w-[750px] mx-auto">
        <h1 className="text-3xl font-bold mb-2">发布采购询价</h1>
        <p className="text-muted mb-8">填写采购需求，平台将根据件号等信息匹配相关供应商</p>
        <Suspense fallback={<div className="p-8 text-center text-muted">加载中...</div>}>
          <RFQForm
            defaultPart={searchParams.partNumber || ""}
            defaultBrand={searchParams.brandName || ""}
            defaultEquipment={searchParams.equipmentModel || ""}
            defaultProductName={searchParams.productName || ""}
          />
        </Suspense>
      </div>
    </div>
  );
}
