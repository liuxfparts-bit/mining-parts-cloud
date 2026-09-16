export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { recommendSuppliersForRFQ } from "@/lib/rfq-invitation";
import { requireVerifiedBuyer } from "@/lib/buyer-company";
import { ShieldCheck } from "lucide-react";
import InvitePanel from "./InvitePanel";

const PAGE_SIZE = 10;

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { q?: string; province?: string; verified?: string; page?: string };
}) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true, buyerCompanyId: true },
  });
  if (!user) redirect("/login");

  const rfq = await prisma.rFQ.findUnique({
    where: { id },
    include: {
      items: { include: { partNumber: true }, orderBy: { seq: "asc" }, take: 5 },
      _count: { select: { items: true } },
    },
  });
  if (!rfq) notFound();
  // 企业共享归属校验（本人或同企业成员）
  const sameCompany =
    rfq.companyID != null && user.buyerCompanyId != null && rfq.companyID === user.buyerCompanyId;
  if (rfq.userID !== user.id && !sameCompany) notFound();

  // 认证门槛：未认证采购商引导去认证，不开放邀请页
  const gate = await requireVerifiedBuyer(user.id);
  if (!gate.allowed) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <ShieldCheck className="w-12 h-12 mx-auto text-blue-500 mb-4" />
        <h1 className="text-lg font-bold text-slate-800">邀请供应商报价需要企业认证</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          {gate.reason || "完善企业资质并通过认证后，即可邀请供应商针对本询价报价"}
        </p>
        <div className="flex justify-center gap-3 mt-6">
          <Link
            href="/dashboard/company"
            className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700"
          >
            前往企业认证
          </Link>
          <Link href={`/dashboard/rfqs/${id}`} className="text-sm text-slate-500 hover:text-slate-700 px-5 py-2">
            返回询价详情
          </Link>
        </div>
      </div>
    );
  }

  // 1) 智能推荐（品牌 + 设备型号 + 件号 + 历史报价 → 打分排序 5~20 家）
  const recommended = await recommendSuppliersForRFQ(id);

  // 2) 已邀请集合（标注"已邀请"，防重复）
  const existingInvites = await prisma.rFQInvitation.findMany({
    where: { rfqId: id },
    select: { supplierId: true, id: true, status: true, reminderCount: true },
  });
  const invitedSupplierIds = new Set(existingInvites.map((i) => i.supplierId).filter(Boolean) as number[]);

  // 3) 我的供应商：历史报价过该采购商询价的供应商（去重）
  const mySuppliers = await prisma.quote.findMany({
    where: { rfq: { userID: user.id } },
    select: {
      supplier: {
        select: {
          id: true,
          name: true,
          shortName: true,
          mainBrands: true,
          mainBusiness: true,
          verifiedStatus: true,
        },
      },
    },
    distinct: ["supplierId"],
    take: 100,
  });
  const mySupplierList = mySuppliers.map((m) => m.supplier).filter((x): x is NonNullable<typeof x> => !!x);

  // 4) 供应商库搜索（数据库级分页）
  const q = (searchParams.q || "").trim();
  const province = (searchParams.province || "").trim();
  const verifiedOnly = searchParams.verified === "1";
  const page = Math.max(1, parseInt(searchParams.page || "1") || 1);

  const where: any = { users: { none: { status: "DISABLED" } } };
  if (verifiedOnly) where.verifiedStatus = "VERIFIED";
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { shortName: { contains: q } },
      { mainBrands: { contains: q } },
      { mainBusiness: { contains: q } },
      { mainEquipment: { contains: q } },
      { products: { some: { partNumber: { number: { contains: q } } } } },
      { products: { some: { oemNumber: { contains: q } } } },
    ];
  }
  if (province) where.province = { contains: province };

  const total = await prisma.supplier.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const searchSuppliers = await prisma.supplier.findMany({
    where,
    select: {
      id: true,
      name: true,
      shortName: true,
      province: true,
      city: true,
      mainBrands: true,
      mainBusiness: true,
      verifiedStatus: true,
      memberLevel: true,
      _count: { select: { quotes: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (cur - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // 汇总前端需要的数据
  const recommendedData = recommended.map((r) => ({
    id: r.supplier.id,
    name: r.supplier.shortName || r.supplier.name,
    fullName: r.supplier.name,
    province: r.supplier.province,
    city: r.supplier.city,
    mainBrands: r.supplier.mainBrands,
    mainEquipment: r.supplier.mainEquipment,
    verified: r.supplier.verifiedStatus === "VERIFIED",
    memberLevel: r.supplier.memberLevel,
    score: r.score,
    reasons: r.reasons,
    quoteCount: r.quoteCount,
  }));

  const searchData = searchSuppliers.map((s) => ({
    id: s.id,
    name: s.shortName || s.name,
    fullName: s.name,
    province: s.province,
    city: s.city,
    mainBrands: s.mainBrands,
    mainBusiness: s.mainBusiness,
    verified: s.verifiedStatus === "VERIFIED",
    memberLevel: s.memberLevel,
    quoteCount: s._count.quotes,
  }));

  const myData = mySupplierList.map((s) => ({
    id: s.id,
    name: s.shortName || s.name,
    fullName: s.name,
    mainBrands: s.mainBrands,
    mainBusiness: s.mainBusiness,
    verified: s.verifiedStatus === "VERIFIED",
    quoteCount: 0,
  }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <a href={`/dashboard/rfqs/${id}`} className="text-sm text-gray-500 hover:text-blue-600">← 返回询价详情</a>
          <h1 className="text-xl font-bold mt-1">邀请供应商报价</h1>
          {rfq.rfqNo && <p className="text-xs font-mono text-gray-400 mt-0.5">{rfq.rfqNo}</p>}
        </div>
      </div>

      {/* 询价基础信息 */}
      <div className="bg-white border rounded-lg p-5 mb-4 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div><span className="text-gray-400 block text-xs">询价标题</span><b>{rfq.title}</b></div>
          <div><span className="text-gray-400 block text-xs">采购明细</span>{rfq._count.items} 项</div>
          <div><span className="text-gray-400 block text-xs">截止时间</span>{rfq.expiresAt ? new Date(rfq.expiresAt).toLocaleDateString("zh-CN") : "未设置"}</div>
          <div><span className="text-gray-400 block text-xs">当前状态</span>{rfq.status}</div>
          <div><span className="text-gray-400 block text-xs">联系人</span>{rfq.contactName || "-"}</div>
        </div>
        {rfq.items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {rfq.items.map((it) => (
              <span key={it.id} className="text-xs bg-gray-100 rounded px-2 py-1 font-mono">
                {it.partNumberStr || it.partNumber?.number || it.productName || `Item ${it.seq}`}
              </span>
            ))}
            {rfq._count.items > 5 && <span className="text-xs text-gray-400 self-center">…共 {rfq._count.items} 项</span>}
          </div>
        )}
      </div>

      <InvitePanel
        rfqId={id}
        recommended={recommendedData}
        searchData={searchData}
        searchMeta={{ total, page: cur, totalPages, pageSize: PAGE_SIZE }}
        mySuppliers={myData}
        invitedSupplierIds={Array.from(invitedSupplierIds)}
        initialSearch={{ q, province, verified: verifiedOnly }}
      />
    </div>
  );
}
