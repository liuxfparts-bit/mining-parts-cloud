export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ReviewButtons from "./ReviewButtons";

export default async function SupplierReview({ params }: { params: { id: string } }) {
  const s = await prisma.supplier.findUnique({ where: { id: parseInt(params.id) } });
  if (!s) notFound();

  return (
    <div className="p-6 max-w-3xl">
      <a href="/admin/verification" className="text-sm text-blue-600 hover:underline">← 返回待审核</a>
      <h1 className="text-2xl font-bold mt-4 mb-6">企业审核：{s.name}</h1>

      <div className="bg-white rounded-lg border p-6 mb-4">
        <h2 className="font-bold mb-3">企业资料</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">联系人：</span>{s.contactName || "-"}</div>
          <div><span className="text-gray-500">电话：</span>{s.mobile || s.telephone || "-"}</div>
          <div><span className="text-gray-500">邮箱：</span>{s.email || "-"}</div>
          <div><span className="text-gray-500">地区：</span>{s.province} {s.city || ""}</div>
          <div><span className="text-gray-500">主营：</span>{s.mainBusiness}</div>
          <div><span className="text-gray-500">状态：</span>{s.verifiedStatus}</div>
        </div>
      </div>

      <ReviewButtons id={s.id} />
    </div>
  );
}
