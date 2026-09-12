import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { submitEquipmentRequest } from "./actions";

export const dynamic = "force-dynamic";

export default async function EquipmentRequestPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/equipment/request");

  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, nameEn: true } });
  const error = searchParams.error;

  return (
    <div className="container py-[42px] max-w-[720px]">
      <h1 className="text-3xl font-bold mb-2">申请新增设备</h1>
      <p className="text-muted mb-6">提交设备资料，平台管理员审核通过后将加入设备数据库。</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">{error}</div>}

      <form action={async (fd) => {
        "use server";
        await submitEquipmentRequest(fd);
      }} className="bg-white border rounded p-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">品牌 *</label>
          <select name="brandId" className="w-full border rounded px-3 py-2">
            <option value="">请选择品牌</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name} {b.nameEn ? `(${b.nameEn})` : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">或填写新品牌名（如品牌列表中没有）</label>
          <input name="brandName" placeholder="例如 Valley Longwall" className="w-full border rounded px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">设备型号 *</label>
            <input name="model" required placeholder="例如 MB670-1" className="w-full border rounded px-3 py-2 font-mono" />
          </div>
          <div>
            <label className="block text-sm mb-1">设备类型 *</label>
            <input name="equipmentType" required placeholder="例如 Bolter Miner" className="w-full border rounded px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">设备名称（中文）*</label>
            <input name="name" required placeholder="例如 锚杆钻车" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">英文名称</label>
            <input name="nameEn" placeholder="Bolter Miner" className="w-full border rounded px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">系列</label>
            <input name="series" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">制造商</label>
            <input name="manufacturer" className="w-full border rounded px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">应用场景</label>
            <input name="application" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">矿山类型</label>
            <input name="mineType" className="w-full border rounded px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">设备图片 URL</label>
          <input name="imageUrl" placeholder="/uploads/xxx.jpg 或 https://..." className="w-full border rounded px-3 py-2 font-mono text-xs" />
        </div>
        <div>
          <label className="block text-sm mb-1">设备描述</label>
          <textarea name="description" rows={4} className="w-full border rounded px-3 py-2" />
        </div>
        <button className="bg-amber-500 text-white px-6 py-2 rounded font-bold">提交申请</button>
        <Link href="/equipment" className="ml-3 text-sm text-muted underline">返回设备列表</Link>
      </form>
    </div>
  );
}
