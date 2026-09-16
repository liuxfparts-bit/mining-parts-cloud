import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInvitationByToken, INV_STATUS_CN, invitationCanQuote } from "@/lib/rfq-invitation";

export const dynamic = "force-dynamic";

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v;
  } catch {
    /* 逗号分隔兼容 */
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export default async function InviteLinkPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const inv = await getInvitationByToken(token);
  if (!inv) notFound();

  const rfq = inv.rfq;
  const buyerUser = rfq.userID
    ? await prisma.user.findUnique({
        where: { id: rfq.userID },
        select: { name: true, company: true, phone: true },
      })
    : null;

  const session = await auth();
  const sessionEmail = (session?.user as any)?.email;
  const sessionUser = sessionEmail
    ? await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { role: true, supplierId: true },
      })
    : null;

  const canQuote = invitationCanQuote(inv, rfq.status);
  const isRejected = inv.status === "REJECTED";
  // 当前登录供应商是否就是被邀请对象
  const isInvitedSupplier = sessionUser?.role === "SUPPLIER" && sessionUser.supplierId != null && inv.supplierId === sessionUser.supplierId;

  const statusText = rfq.status === "CLOSED" || rfq.status === "EXPIRED" ? "该询价已结束" : canQuote ? "" : "该邀请已失效";
  const showQuoteCta = canQuote && !isRejected;

  return (
    <div className="container py-[42px]">
      <div className="max-w-[860px] mx-auto">
        {/* 头部 */}
        <div className="bg-white border rounded-t-lg p-6 border-b-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-1 font-mono">
              {rfq.rfqNo || `RFQ #${rfq.id}`}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-1">采购询价邀请</span>
            {inv.supplierId != null && (
              <span className="text-xs bg-green-50 text-green-700 rounded px-2 py-1">定向邀请</span>
            )}
          </div>
          <h1 className="text-2xl font-bold mt-3">{rfq.title}</h1>
          <p className="text-sm text-gray-500 mt-2">
            采购方：
            {buyerUser?.company || buyerUser?.name || rfq.contactName || "矿配云采购商"}
            {rfq.contactPhone ? ` · ${rfq.contactPhone}` : ""}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
            <div><span className="text-gray-400 block text-xs">采购项目</span>{rfq.items.length > 0 ? `${rfq.items.length} 项` : (rfq.partNumberStr ? "1 项" : "-")}</div>
            <div><span className="text-gray-400 block text-xs">截止时间</span>{rfq.expiresAt ? new Date(rfq.expiresAt).toLocaleString("zh-CN") : "未设置"}</div>
            <div><span className="text-gray-400 block text-xs">交货地点</span>{rfq.deliveryLocation || "-"}</div>
            <div><span className="text-gray-400 block text-xs">贸易条款</span>{rfq.incoterm || "-"}</div>
          </div>
        </div>

        {/* 采购明细 */}
        <div className="bg-white border rounded-b-lg p-6 mb-5">
          <h2 className="font-bold mb-3">采购明细</h2>
          {rfq.items.length === 0 && rfq.partNumberStr ? (
            <div className="text-sm border rounded-lg p-4 flex flex-wrap gap-x-6 gap-y-1">
              <span><b>件号：</b><span className="font-mono">{rfq.partNumberStr}</span></span>
              <span><b>品牌：</b>{rfq.brandName || "-"}</span>
              <span><b>设备型号：</b>{rfq.equipmentModel || "-"}</span>
              <span><b>数量：</b>{rfq.quantity} {rfq.unit}</span>
            </div>
          ) : (
            <div className="space-y-2">
              {rfq.items.map((it) => {
                const imgs = parseImages(it.images);
                return (
                  <div key={it.id} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold bg-gray-100 rounded px-2 py-0.5">Item {it.seq}</span>
                      {it.brandName && <span className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">{it.brandName}</span>}
                      {it.equipmentModel && <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{it.equipmentModel}</span>}
                      {(it.partNumberStr || it.partNumber?.number) && (
                        <span className="text-xs font-mono bg-gray-100 rounded px-2 py-0.5">{it.partNumberStr || it.partNumber?.number}</span>
                      )}
                    </div>
                    <p className="text-sm mt-1.5">
                      {it.productName && <b>{it.productName}</b>}
                      <span className="text-gray-500 text-xs ml-2">数量：{it.quantity} {it.unit}</span>
                    </p>
                    {it.description && <p className="text-gray-500 text-xs mt-1 leading-relaxed">{it.description}</p>}
                    {imgs.length > 0 && (
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2 mt-3">
                        {imgs.map((src) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={src} src={src} alt={`Item ${it.seq}`} className="h-16 w-full object-cover rounded border" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 引导区 */}
        <div className="bg-white border rounded-lg p-6 text-center">
          {statusText ? (
            <>
              <p className="text-lg font-bold text-gray-600">{statusText}</p>
              <p className="text-sm text-gray-400 mt-1">当前邀请状态：{INV_STATUS_CN[inv.status] || inv.status}</p>
            </>
          ) : sessionUser?.role === "SUPPLIER" ? (
            <>
              <p className="text-lg font-bold mb-1">
                {isInvitedSupplier ? "欢迎回来！" : "您已登录供应商账号"}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {isInvitedSupplier
                  ? "该邀请已关联到您的账号，可直接进入报价。"
                  : "登录账号未绑定本次邀请，报价后将自动关联。"}
              </p>
              <Link
                href={`/rfq/${rfq.id}/quote?inv=${token}`}
                className="inline-block bg-blue-600 text-white font-bold px-8 py-3 rounded hover:bg-blue-700"
              >
                进入报价
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg font-bold mb-1">收到采购方询价邀请</p>
              <p className="text-sm text-gray-500 mb-5">注册/登录后即可查看并提交报价</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={`/register?token=${token}&role=SUPPLIER`}
                  className="inline-block bg-blue-600 text-white font-bold px-8 py-3 rounded hover:bg-blue-700"
                >
                  注册并报价
                </Link>
                <Link
                  href={`/login?token=${token}`}
                  className="inline-block border border-gray-300 text-gray-700 font-bold px-8 py-3 rounded hover:bg-gray-50"
                >
                  已有账号？直接登录
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
