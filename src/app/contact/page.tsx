import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "联系我们｜矿配云",
  description: "通过平台发布询价或企业入驻与矿配云团队联系。",
};

export default function ContactPage() {
  return (
    <div className="container py-[42px] max-w-[900px]">
      <h1 className="text-3xl font-bold mb-4">联系我们</h1>
      <p className="leading-relaxed mb-6">
        如您在使用矿配云过程中有任何问题、合作意向或企业入驻需求，欢迎通过以下方式与我们联系。
      </p>

      <div className="bg-white border rounded-lg p-6 space-y-4">
        <p>请通过平台发布询价或企业入驻流程与我们联系。</p>
        <p>如您是采购方：<Link href="/rfq/create" className="text-blue-600 underline">免费发布询价</Link></p>
        <p>如您是供应商：<Link href="/register" className="text-blue-600 underline">企业入驻</Link></p>
      </div>
    </div>
  );
}
