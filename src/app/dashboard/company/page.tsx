export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitCompanyVerification } from "./actions";
import ImageUpload from "@/components/ImageUpload";
import { getBuyerCompanyForUser, BUYER_VERIFY_STATUS_CN, BUYER_LEVEL_CN, BUYER_LEVEL_BADGE } from "@/lib/buyer-company";
import { ShieldCheck, Clock, CircleX, Building2 } from "lucide-react";

export default async function BuyerCompanyPage({
  searchParams,
}: {
  searchParams: { submitted?: string };
}) {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, isOwner: true },
  });
  if (!user) redirect("/login");

  const company = await getBuyerCompanyForUser(user.id);
  const status = company?.verifiedStatus || "UNSUBMITTED";
  const submitted = searchParams.submitted === "1";

  const statusCard =
    ({
      UNSUBMITTED: { icon: ShieldCheck, title: "未提交认证", desc: "完善企业资质并通过认证后，可发布 RFQ 及邀请供应商报价", cls: "bg-slate-50 text-slate-600 border-slate-200" },
      PENDING: { icon: Clock, title: "待审核", desc: "资质已提交，平台审核中（通常 1-2 个工作日）", cls: "bg-amber-50 text-amber-700 border-amber-200" },
      VERIFIED: { icon: ShieldCheck, title: "已认证", desc: "企业认证已通过，可正常发布询价与邀请供应商", cls: "bg-green-50 text-green-700 border-green-200" },
      REJECTED: { icon: CircleX, title: "已驳回", desc: company?.rejectionReason || "资质未通过审核，请修改后重新提交", cls: "bg-red-50 text-red-700 border-red-200" },
    } as Record<string, { icon: any; title: string; desc: string; cls: string }>)[status]!;

  const canEdit = status !== "VERIFIED";

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">企业资料与认证</h1>
        <p className="text-sm text-slate-500 mt-0.5">完善企业资质，认证通过后获得发布询价与邀请供应商权限</p>
      </div>

      {submitted && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          企业资质已提交，等待平台审核
        </div>
      )}

      {/* 状态卡 */}
      <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${statusCard.cls}`}>
        <statusCard.icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-sm">{statusCard.title}</div>
          <div className="text-xs opacity-80 mt-0.5">{statusCard.desc}</div>
        </div>
        {company && (
          <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border bg-white ${BUYER_LEVEL_BADGE[company.level]}`}>
            {BUYER_LEVEL_CN[company.level]}会员
          </span>
        )}
      </div>

      {!canEdit ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-sm text-slate-700">认证企业信息</h2>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ["企业名称", company?.companyName],
              ["统一社会信用代码", company?.unifiedCode || "未填写"],
              ["联系人", company?.contactName || "未填写"],
              ["联系电话", company?.contactPhone || "未填写"],
              ["地区", company?.region || "未填写"],
              ["企业地址", company?.address || "未填写"],
              ["认证状态", BUYER_VERIFY_STATUS_CN[status]],
              ["企业等级", `${BUYER_LEVEL_CN[company?.level || "NORMAL"]}会员`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-slate-50 pb-2">
                <dt className="text-slate-500 shrink-0">{k}</dt>
                <dd className="text-slate-800 text-right break-all">{v}</dd>
              </div>
            ))}
          </dl>
          {company?.licenseImage && (
            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-1">营业执照</div>
              <img src={company.licenseImage} alt="营业执照" className="max-h-48 rounded-lg border border-slate-200" />
            </div>
          )}
          <p className="text-xs text-slate-400 mt-4">
            企业已认证，如需变更企业资质信息请联系平台管理员。
          </p>
        </div>
      ) : (
        <form action={submitCompanyVerification} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                企业名称 <span className="text-red-500">*</span>
              </label>
              <input
                name="companyName"
                required
                defaultValue={company?.companyName || ""}
                placeholder="如：山西宁东矿山设备有限公司"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">统一社会信用代码 / 营业执照号</label>
              <input
                name="unifiedCode"
                defaultValue={company?.unifiedCode || ""}
                placeholder="如：91140000XXXXXXXXXX"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">营业执照照片</label>
              <div className="text-xs text-slate-400 mb-1">支持 JPG/PNG</div>
              <ImageUploadClient defaultValue={company?.licenseImage || ""} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">联系人</label>
              <input
                name="contactName"
                defaultValue={company?.contactName || user ? "" : ""}
                placeholder="采购负责人姓名"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">联系电话</label>
              <input
                name="contactPhone"
                defaultValue={company?.contactPhone || ""}
                placeholder="手机 / 座机"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">地区</label>
              <input
                name="region"
                defaultValue={company?.region || ""}
                placeholder="如：中国 · 山西 · 朔州"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">企业地址</label>
              <input
                name="address"
                defaultValue={company?.address || ""}
                placeholder="详细地址"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
          </div>
          {status === "REJECTED" && company?.rejectionReason && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              驳回原因：{company.rejectionReason}
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700"
            >
              {status === "REJECTED" ? "重新提交认证" : "提交认证"}
            </button>
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
              返回概览
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

// 客户端图片上传（避免服务端组件直接渲染文件输入）
function ImageUploadClient({ defaultValue }: { defaultValue: string }) {
  return <ImageUpload name="licenseImage" defaultValue={defaultValue} />;
}
