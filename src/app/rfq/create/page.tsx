import { Suspense } from "react";
import RFQForm from "@/components/RFQForm";

export default function NewRFQPage({
  searchParams,
}: {
  searchParams: { partNumber?: string };
}) {
  return (
    <div className="container py-[42px]">
      <div className="max-w-[750px] mx-auto">
        <h1 className="text-3xl font-bold mb-2">发布采购询价</h1>
        <p className="text-muted mb-8">填写后平台智能匹配多家供应商报价</p>
        <Suspense fallback={<div className="p-8 text-center text-muted">加载中...</div>}>
          <RFQForm defaultPart={searchParams.partNumber || ""} />
        </Suspense>
      </div>
    </div>
  );
}
