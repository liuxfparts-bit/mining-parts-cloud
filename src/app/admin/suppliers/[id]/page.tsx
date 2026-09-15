export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { reviewSupplier, updateMemberLevel } from "../../actions";
import { verifiedStatusCN } from "@/lib/verify-status";

export default async function SupplierDetail({ params }: { params: { id: string } }) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      _count: { select: { products: true, quotes: true } },
      products: { orderBy: { createdAt: "desc" }, take: 20 },
      quotes: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { rfq: { select: { rfqNo: true, title: true } } },
      },
    },
  });
  if (!supplier) notFound();

  // 空值兜底：任何可能为 null 的展示字段统一回退，避免空白/渲染中断
  const region = [supplier.province, supplier.city].filter(Boolean).join(" ") || "未填写";
  const products = supplier.products ?? [];
  const quotes = supplier.quotes ?? [];
  const productCount = supplier._count?.products ?? 0;
  const quoteCount = supplier._count?.quotes ?? 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <a href="/admin/suppliers" className="text-sm text-blue-600 hover:underline">← 返回企业列表</a>
        <a href={`/admin/suppliers/${supplier.id}/edit`} className="text-sm bg-blue-600 text-white px-4 py-1 rounded">编辑</a>
      </div>

      {/* 基本信息 */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">{supplier.name || "未命名企业"}</h1>
            <p className="text-gray-500">{supplier.nameEn || supplier.shortName || ""}</p>
          </div>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded text-sm ${supplier.verifiedStatus === "VERIFIED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
              {verifiedStatusCN(supplier.verifiedStatus)}
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">{supplier.memberLevel || "FREE"}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500">联系人：</span>{supplier.contactName || "未填写"}</div>
          <div><span className="text-gray-500">电话：</span>{supplier.mobile || supplier.telephone || "未填写"}</div>
          <div><span className="text-gray-500">邮箱：</span>{supplier.email || "未填写"}</div>
          <div><span className="text-gray-500">微信：</span>{supplier.wechat || "未填写"}</div>
          <div><span className="text-gray-500">WhatsApp：</span>{supplier.whatsapp || "未填写"}</div>
          <div><span className="text-gray-500">地区：</span>{region}</div>
          <div className="col-span-2"><span className="text-gray-500">主营：</span>{supplier.mainBusiness || "未填写"}</div>
          <div><span className="text-gray-500">主营品牌：</span>{supplier.mainBrands || "未填写"}</div>
          <div><span className="text-gray-500">主营设备：</span>{supplier.mainEquipment || "未填写"}</div>
          <div><span className="text-gray-500">产品数：</span>{productCount}</div>
          <div><span className="text-gray-500">报价数：</span>{quoteCount}</div>
          <div><span className="text-gray-500">入驻时间：</span>{supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString("zh-CN") : "未填写"}</div>
        </div>
      </div>

      {/* 审核操作 */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="font-bold mb-4">审核操作</h2>
        <div className="flex flex-wrap items-center gap-3">
          {supplier.verifiedStatus !== "VERIFIED" && (
            <form action={async () => { "use server"; await reviewSupplier(supplier.id, "VERIFIED"); }}>
              <button className="bg-green-600 text-white px-4 py-2 rounded text-sm">✓ 审核通过</button>
            </form>
          )}
          {supplier.verifiedStatus !== "REJECTED" && (
            <form action={async () => { "use server"; await reviewSupplier(supplier.id, "REJECTED"); }}>
              <button className="bg-red-600 text-white px-4 py-2 rounded text-sm">✕ 驳回</button>
            </form>
          )}
          <span className="text-xs text-gray-400 self-center">当前状态：{verifiedStatusCN(supplier.verifiedStatus)}</span>
        </div>

        <h2 className="font-bold mt-6 mb-3">修改会员等级</h2>
        <form action={async (fd: FormData) => { "use server"; await updateMemberLevel(supplier.id, String(fd.get("memberLevel") || "FREE")); }}>
          <div className="flex flex-wrap gap-2 items-center">
            <select name="memberLevel" defaultValue={supplier.memberLevel || "FREE"} className="border rounded px-3 py-2 text-sm">
              <option value="FREE">FREE（免费）</option>
              <option value="BRONZE">BRONZE（铜牌）</option>
              <option value="SILVER">SILVER（银牌）</option>
              <option value="GOLD">GOLD（金牌）</option>
            </select>
            <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">保存等级</button>
          </div>
        </form>
      </div>

      {/* 产品列表 */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="font-bold mb-2">产品列表</h2>
        <p className="text-xs text-gray-400 mb-4">共 {productCount} 个产品，展示最近 {Math.min(products.length, 20)} 条</p>
        {products.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">暂无相关记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">产品名称</th>
                  <th className="py-2 pr-4">OEM 件号</th>
                  <th className="py-2 pr-4">类型</th>
                  <th className="py-2 pr-4">价格</th>
                  <th className="py-2 pr-4">库存</th>
                  <th className="py-2 pr-4">状态</th>
                  <th className="py-2 pr-4">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2 pr-4">{p.name || "-"}</td>
                    <td className="py-2 pr-4">{p.oemNumber || "-"}</td>
                    <td className="py-2 pr-4">{p.productType || "-"}</td>
                    <td className="py-2 pr-4">{p.price != null ? `${p.currency || "CNY"} ${p.price.toLocaleString()}` : "-"}</td>
                    <td className="py-2 pr-4">{p.stock != null ? p.stock : "-"}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${p.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {p.status || "-"}
                      </span>
                      {p.verificationStatus && p.verificationStatus !== "VERIFIED" && (
                        <span className="ml-1 px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">{p.verificationStatus}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{p.createdAt ? new Date(p.createdAt).toLocaleDateString("zh-CN") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 报价记录 */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="font-bold mb-2">报价记录</h2>
        <p className="text-xs text-gray-400 mb-4">共 {quoteCount} 条报价，展示最近 {Math.min(quotes.length, 20)} 条</p>
        {quotes.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">暂无相关记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">RFQ 编号</th>
                  <th className="py-2 pr-4">询价标题</th>
                  <th className="py-2 pr-4">报价金额</th>
                  <th className="py-2 pr-4">已报价项</th>
                  <th className="py-2 pr-4">状态</th>
                  <th className="py-2 pr-4">报价时间</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-b">
                    <td className="py-2 pr-4">
                      <a href={`/admin/rfqs/${q.rfqId}`} className="text-blue-600 hover:underline">
                        {q.rfq?.rfqNo || `RFQ#${q.rfqId}`}
                      </a>
                    </td>
                    <td className="py-2 pr-4">{q.rfq?.title || "-"}</td>
                    <td className="py-2 pr-4">
                      {q.totalAmount != null ? `${q.currency || "CNY"} ${q.totalAmount.toLocaleString()}` : (q.unitPrice != null ? `${q.currency || "CNY"} ${q.unitPrice.toLocaleString()}` : "-")}
                    </td>
                    <td className="py-2 pr-4">{q.quotedCount != null ? `${q.quotedCount} 项` : "-"}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${q.status === "ACCEPTED" ? "bg-green-100 text-green-700" : q.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                        {q.status || "PENDING"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{q.createdAt ? new Date(q.createdAt).toLocaleString("zh-CN") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
