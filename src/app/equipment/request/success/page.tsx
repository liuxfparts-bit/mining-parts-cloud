import Link from "next/link";

export default function EquipmentRequestSuccess() {
  return (
    <div className="container py-[42px] max-w-[600px] text-center">
      <h1 className="text-2xl font-bold mb-3">申请已提交</h1>
      <p className="mb-6">您的新增设备申请已提交，平台管理员审核后将正式加入设备数据库。</p>
      <Link href="/equipment" className="text-amber-600 underline">返回设备列表</Link>
    </div>
  );
}
