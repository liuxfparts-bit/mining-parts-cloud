export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { approveBuyerCompany, rejectBuyerCompany } from "../actions";
import { BUYER_VERIFY_STATUS_CN, BUYER_LEVEL_CN, BUYER_LEVEL_BADGE } from "@/lib/buyer-company";

export default async function AdminBuyerCompanyDetail({ params }: { params: { id: string } }) {
  const s = await auth();
  if (!s || (s.user as any)?.role !== "ADMIN") redirect("/admin");

  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const company = await prisma.buyerCompany.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, phone: true, position: true, isOwner: true, status: true } },
      _count: { select: { users: true } },
    },
  });
  if (!company) notFound();

  const owner = company.users.find((u) => u.isOwner);

  // 该企业发布的 RFQ 统计（用于审核参考）
  const rfqCount = await prisma.rFQ.count({ where: { companyID: company.id } });
  const quoteCount = await prisma.quote.count({ where: { rfq: { companyID: company.id } } });

  const isVerified = company.verifiedStatus === "VERIFIED";

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/buyer-companies" className="text-sm text-slate-500 hover:text-slate-700">
            ← 返回列表
          </Link>
          <h1 className="text-xl font-bold mt-1">{company.companyName}</h1>
          <span
            className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
              company.verifiedStatus === "PENDING"
                ? "bg-amber-50 text-amber-700"
                : company.verifiedStatus === "VERIFIED"
                  ? "bg-green-50 text-green-700"
                  : company.verifiedStatus === "REJECTED"
                    ? "bg-red-50 text-red-600"
                    : "bg-slate-100 text-slate-500"
            }`}
          >
            {BUYER_VERIFY_STATUS_CN[company.verifiedStatus]}
          </span>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full border bg-white ${BUYER_LEVEL_BADGE[company.level]}`}
        >
          当前等级：{BUYER_LEVEL_CN[company.level]}
        </span>
      </div>

      {/* 企业资质 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <h2 className="font-semibold text-sm text-slate-700 mb-4">企业资质</h2>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ["企业名称", company.companyName],
            ["统一社会信用代码", company.unifiedCode || "未填写"],
            ["联系人", company.contactName || "未填写"],
            ["联系电话", company.contactPhone || "未填写"],
            ["地区", company.region || "未填写"],
            ["企业地址", company.address || "未填写"],
            ["提交时间", company.submittedAt ? new Date(company.submittedAt).toLocaleString("zh-CN") : "-"],
            ["业务数据", `发布询价 ${rfqCount} 条 · 收到报价 ${quoteCount} 条`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-slate-50 pb-2">
              <dt className="text-slate-500 shrink-0">{k}</dt>
              <dd className="text-slate-800 text-right break-all">{v}</dd>
            </div>
          ))}
        </dl>
        {company.licenseImage && (
          <div className="mt-4">
            <div className="text-xs text-slate-500 mb-1">营业执照</div>
            <a href={company.licenseImage} target="_blank" rel="noreferrer">
              <img
                src={company.licenseImage}
                alt="营业执照"
                className="max-h-64 rounded-lg border border-slate-200 cursor-zoom-in"
              />
            </a>
          </div>
        )}
        {company.rejectionReason && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
            驳回原因：{company.rejectionReason}
          </div>
        )}
      </div>

      {/* 企业成员 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <h2 className="font-semibold text-sm text-slate-700 mb-3">企业成员（{company._count.users}）</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left p-2.5">姓名</th>
                <th className="text-left p-2.5">邮箱</th>
                <th className="text-left p-2.5">手机</th>
                <th className="text-left p-2.5">岗位</th>
                <th className="text-left p-2.5">角色</th>
                <th className="text-left p-2.5">状态</th>
              </tr>
            </thead>
            <tbody>
              {company.users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="p-2.5 font-medium">{u.name}</td>
                  <td className="p-2.5 text-slate-500">{u.email}</td>
                  <td className="p-2.5 text-slate-500">{u.phone || "-"}</td>
                  <td className="p-2.5">{u.position || "采购员"}</td>
                  <td className="p-2.5">
                    {u.isOwner ? (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        主账号
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-500">子账号</span>
                    )}
                  </td>
                  <td className="p-2.5">
                    {u.status === "ACTIVE" ? (
                      <span className="text-[11px] text-green-600">启用</span>
                    ) : (
                      <span className="text-[11px] text-red-500">禁用</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!owner && (
          <p className="text-xs text-amber-600 mt-2">该企业暂无主账号（通过认证时自动确认提交人为主账号）</p>
        )}
      </div>

      {/* 审核操作 */}
      {!isVerified ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <h2 className="font-semibold text-sm text-slate-700 mb-4">审核操作</h2>
          <form action={approveBuyerCompany} className="flex flex-wrap items-end gap-4">
            <input type="hidden" name="id" value={company.id} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">企业会员等级</label>
              <select
                name="level"
                defaultValue={company.level}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="NORMAL">普通</option>
                <option value="BRONZE">铜牌</option>
                <option value="SILVER">银牌</option>
                <option value="GOLD">金牌</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-green-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-green-700"
            >
              ✓ 审核通过
            </button>
          </form>

          <form action={rejectBuyerCompany} className="mt-4 flex flex-wrap items-end gap-4">
            <input type="hidden" name="id" value={company.id} />
            <div className="flex-1 min-w-[260px]">
              <label className="block text-sm font-medium text-slate-700 mb-1">驳回原因</label>
              <input
                name="reason"
                required
                placeholder="如：营业执照不清晰 / 信息不完整"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="bg-red-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-red-700"
            >
              ✕ 驳回
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <h2 className="font-semibold text-sm text-slate-700 mb-2">已审核通过</h2>
          <p className="text-sm text-slate-500">
            审核时间：{company.verifiedAt ? new Date(company.verifiedAt).toLocaleString("zh-CN") : "-"} · 企业等级：
            {BUYER_LEVEL_CN[company.level]}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            如需调整企业等级或冻结认证，请联系超管直接操作数据库。
          </p>
        </div>
      )}
    </div>
  );
}
