import Link from "next/link";

export default function SuccessPage() {
  return (
    <div className="container py-[42px] max-w-[600px] text-center">
      <h1 className="text-2xl font-bold mb-3">申请已提交</h1>
      <p className="mb-6">您的新增件号申请已提交，平台管理员审核后将正式收录。</p>
      <Link href="/part-number" className="text-amber-600 underline">返回件号库</Link>
    </div>
  );
}
