import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "企业认证｜矿配云",
  description: "矿配云企业认证流程说明。",
};

export default function CertificationPage() {
  return (
    <div className="container py-[42px] max-w-[900px]">
      <h1 className="text-3xl font-bold mb-4">企业认证</h1>
      <p className="leading-relaxed mb-6">
        矿配云通过企业资料与营业执照对入驻供应商进行审核。认证通过后，企业主页与产品页将展示认证标识，提高采购方信任度。
      </p>

      <h2 className="text-xl font-bold mb-4">认证流程</h2>
      <ol className="list-decimal pl-6 space-y-3 mb-8">
        <li><strong>提交企业资料</strong>：注册账号后填写企业名称、统一社会信用代码、主营品牌、主营设备、联系人。</li>
        <li><strong>平台审核</strong>：平台对提交资料进行真实性审核。</li>
        <li><strong>认证通过</strong>：审核通过后企业状态变更为"已认证"。</li>
        <li><strong>展示认证标识</strong>：前台企业卡片与产品列表显示 ✓ 已认证标识。</li>
      </ol>

      <div className="bg-slate-50 border rounded p-6 text-center">
        <p className="mb-3">立即入驻并提交企业资料</p>
        <Link href="/register" className="inline-block bg-amber-500 text-white px-6 py-2 rounded font-bold">企业入驻</Link>
      </div>
    </div>
  );
}
