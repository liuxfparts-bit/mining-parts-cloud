import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "会员服务｜矿配云",
  description: "矿配云会员服务说明。",
};

export default function MembershipPage() {
  return (
    <div className="container py-[42px] max-w-[900px]">
      <h1 className="text-3xl font-bold mb-4">会员服务</h1>
      <p className="leading-relaxed mb-6">矿配云为供应商与采购方提供基础的免费展示与询价服务。更完善的会员权益正在规划中。</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-bold mb-2">免费会员</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
            <li>企业基础信息展示</li>
            <li>产品 / 件号发布</li>
            <li>接收平台公开询价</li>
            <li>基础搜索曝光</li>
          </ul>
        </div>
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-bold mb-2">高级会员（即将开放）</h2>
          <p className="text-sm text-muted">会员服务即将开放，敬请期待。</p>
        </div>
      </div>

      <div className="mt-8 bg-slate-50 border rounded p-6 text-center">
        <p className="mb-3">现在入驻，抢先体验平台基础服务</p>
        <Link href="/register" className="inline-block bg-amber-500 text-white px-6 py-2 rounded font-bold">企业入驻</Link>
      </div>
    </div>
  );
}
