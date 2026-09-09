export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { reviewSupplier, updateMemberLevel } from "../../actions";

export default async function SupplierDetail({ params }: { params: { id: string } }) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: parseInt(params.id) },
    include: { _count: { select: { products: true, quotes: true } } },
  });
  if (!supplier) notFound();

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <a href="/admin/suppliers" className="text-sm text-blue-600 hover:underline">← 返回企业列表</a>
        <a href={`/admin/suppliers/${supplier.id}/edit`} className="text-sm bg-blue-600 text-white px-4 py-1 rounded">编辑</a>
      </div>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">{supplier.name}</h1>
            <p className="text-gray-500">{supplier.nameEn || supplier.shortName || ""}</p>
          </div>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded text-sm ${supplier.verifiedStatus === "VERIFIED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
              {supplier.verifiedStatus}
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">{supplier.memberLevel}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500">联系人：</span>{supplier.contactName || "-"}</div>
          <div><span className="text-gray-500">电话：</span>{supplier.mobile || supplier.telephone || "-"}</div>
          <div><span className="text-gray-500">邮箱：</span>{supplier.email || "-"}</div>
          <div><span className="text-gray-500">微信：</span>{supplier.wechat || "-"}</div>
          <div><span className="text-gray-500">WhatsApp：</span>{supplier.whatsapp || "-"}</div>
          <div><span className="text-gray-500">地区：</span>{supplier.province} {supplier.city || ""}</div>
          <div><span className="text-gray-500">主营：</span>{supplier.mainBusiness}</div>
          <div><span className="text-gray-500">产品数：</span>{supplier._count.products}</div>
          <div><span className="text-gray-500">报价数：</span>{supplier._count.quotes}</div>
        </div>
      </div>

      {/* 审核操作 */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="font-bold mb-4">审核操作</h2>
        <div className="flex gap-3">
          {supplier.verifiedStatus !== "VERIFIED" && (
            <form action={async () => { "use server"; await reviewSupplier(supplier.id, "APPROVED"); }}>
              <button className="bg-green-600 text-white px-4 py-2 rounded text-sm">✓ 审核通过</button>
            </form>
          )}
          {supplier.verifiedStatus !== "REJECTED" && (
            <form action={async () => { "use server"; await reviewSupplier(supplier.id, "REJECTED"); }}>
              <button className="bg-red-600 text-white px-4 py-2 rounded text-sm">✕ 驳回</button>
            </form>
          )}
        </div>

        <h2 className="font-bold mt-6 mb-3">修改会员等级</h2>
        <div className="flex gap-2">
          {["FREE", "BRONZE", "SILVER", "GOLD"].map((lv) => (
            <form key={lv} action={async () => { "use server"; await updateMemberLevel(supplier.id, lv); }}>
              <button className={`px-3 py-1 rounded text-sm ${supplier.memberLevel === lv ? "bg-blue-600 text-white" : "bg-gray-100"}`}>{lv}</button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
