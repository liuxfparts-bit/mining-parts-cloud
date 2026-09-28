import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Send, Store, HelpCircle, CalendarCheck } from "lucide-react";
import { verifiedStatusCN } from "@/lib/verify-status";
import { PUBLIC_PRODUCT_WHERE_NESTED } from "@/lib/public-product";
import { PUBLIC_PN_WHERE } from "@/lib/part-number";

export const dynamic = "force-dynamic";

// ===== 名称显示 helper：避免 A · A 重复 =====
function displayPartName(name: string, nameEn: string | null): { primary: string; secondary: string | null } {
  const n = (name || "").trim();
  const e = (nameEn || "").trim();
  if (!e) return { primary: n, secondary: null };
  // case-insensitive + trim 比较，适合中英文混排
  if (n.toLowerCase() === e.toLowerCase()) return { primary: n, secondary: null };
  return { primary: n, secondary: e };
}

// ===== 日期格式化 =====
function formatDate(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function generateMetadata({
  params,
}: {
  params: { partNumber: string };
}): Promise<Metadata> {
  const pn = await prisma.partNumber.findUnique({
    where: { slug: params.partNumber },
    include: {
      brand: true,
      equipmentRelations: { include: { equipmentModel: true } },
    },
  });
  if (!pn) return { title: "件号未找到 | 矿配云" };
  const equipModels = pn.equipmentRelations.map((r) => r.equipmentModel.model).join(" ");
  const brandName = pn.brand?.name || "";
  const title = pn.seoTitle || `${pn.number} ${pn.name} | ${brandName} ${equipModels} | 矿配云`;
  const description = pn.seoDescription || `查询 ${brandName} ${equipModels} 件号 ${pn.number}（${pn.name}）的适用设备、分类、供应商及询价信息。`;
  return { title, description };
}

const TYPE_LABEL: Record<string, string> = {
  OEM: "OEM 原厂", Replacement: "替代件", Aftermarket: "售后件", Used: "二手", Reconditioned: "再制造",
};

export default async function PartNumberDetailPage({
  params,
}: {
  params: { partNumber: string };
}) {
  const pn = await prisma.partNumber.findUnique({
    where: { slug: params.partNumber },
    include: {
      brand: true,
      equipmentRelations: { include: { equipmentModel: true } },
      products: {
        where: PUBLIC_PRODUCT_WHERE_NESTED,
        include: { supplier: true },
        orderBy: { price: "asc" },
      },
      _count: { select: { rfqs: true } },
    },
  });
  if (!pn) notFound();

  // 公开页面唯一门槛：件号本身必须 VERIFIED + READY。
  if (pn.verificationStatus !== "VERIFIED" || pn.publishStatus !== "READY") notFound();

  const supplierCount = new Set(pn.products.map((p) => p.supplierId)).size;

  // V3.1: PartNumberEquipment 是适用设备的唯一正式来源
  const equipmentList = pn.equipmentRelations.map(
    (r) => r.equipmentModel
  );

  const { primary: displayName, secondary: displayNameEn } = displayPartName(pn.name, pn.nameEn);

  // P2-1B-3: RFQ prefill uses reviewed Part Number master data.
  // Equipment is only prefilled from a VERIFIED PN -> Equipment relation.
  const verifiedEquipmentRelation = pn.equipmentRelations.find(
    (relation) => relation.verificationStatus === "VERIFIED"
  );

  const rfqParams = new URLSearchParams();
  rfqParams.set("partNumber", pn.number);
  if (pn.brand?.name) rfqParams.set("brandName", pn.brand.name);
  if (verifiedEquipmentRelation?.equipmentModel.model) {
    rfqParams.set("equipmentModel", verifiedEquipmentRelation.equipmentModel.model);
  }
  if (displayName) rfqParams.set("productName", displayName);

  const rfqCreateHref = `/rfq/create?${rfqParams.toString()}`;

  // 相关件号：优先同设备（PartNumberEquipment），其次同品牌+同分类；deterministic；排除自己和非 READY
  const relatedEquipIds = equipmentList.map((e) => e.id);
  const relatedParts = await prisma.partNumber.findMany({
    where: {
      id: { not: pn.id },
      ...PUBLIC_PN_WHERE,
      OR: [
        ...(relatedEquipIds.length > 0
          ? [{ equipmentRelations: { some: { equipmentModelId: { in: relatedEquipIds } } } }]
          : []),
        { AND: [{ brandId: pn.brandId || -1 }, { category: pn.category }] },
      ],
    },
    take: 10,
    orderBy: { number: "asc" },
  });

  // breadcrumb items（空 label 不渲染）
  const breadcrumbItems: { label: string; href?: string }[] = [
    { label: "首页", href: "/" },
    { label: "找件号", href: "/part-number" },
  ];
  if (pn.category) breadcrumbItems.push({ label: pn.category });
  breadcrumbItems.push({ label: pn.number });

  return (
    <div className="container py-4 md:py-6">
      {/* 面包屑：空 label 不渲染 separator */}
      <nav className="text-xs text-muted mb-3 flex flex-wrap items-center gap-1">
        {breadcrumbItems.map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-line">/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-accent">{item.label}</Link>
            ) : (
              <span className={i === breadcrumbItems.length - 1 ? "font-mono font-medium text-ink" : ""}>{item.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* 件号主信息 */}
      <div className="bg-white border border-line rounded-lg p-4 md:p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-mono text-2xl md:text-3xl font-bold text-accent break-all">{pn.number}</h1>
            <p className="text-lg font-medium mt-1">
              {displayName}
              {displayNameEn && <span className="text-muted ml-2">{displayNameEn}</span>}
            </p>
            {/* badges：必须 wrap，手机端不溢出 */}
            <div className="flex flex-wrap gap-2 mt-3">
              {pn.brand && (
                <Link href={`/brands/${pn.brand.slug}`}>
                  <Badge className="hover:bg-accent/10">{pn.brand.name}</Badge>
                </Link>
              )}
              {equipmentList.map((eq) => (
                <Link key={eq.id} href={`/equipment/${eq.slug}`}>
                  <Badge variant="outline" className="hover:bg-accent/10">{eq.model}</Badge>
                </Link>
              ))}
              {pn.category && <Badge variant="secondary">{pn.category}</Badge>}
              {pn.verificationStatus === "VERIFIED" ? (
                <span className="inline-flex items-center gap-1 text-xs text-brandGreen" title="该 Part Number 主数据已经过矿配云审核。此状态不代表某一设备适配关系已验证，也不代表原厂授权、库存状态或供应商资质。">
                  <CheckCircle2 size={13} /> 已验证
                </span>
              ) : (
                <span className="text-xs text-muted">待验证</span>
              )}
            </div>
          </div>
          {/* 统计：手机端横向排列不挤 */}
          <div className="text-right flex md:flex-col gap-4 md:gap-1">
            <div><div className="text-2xl font-bold text-accent">{supplierCount}</div><div className="text-xs text-muted">家供应商</div></div>
            <div><div className="text-2xl font-bold text-accent">{pn.products.length}</div><div className="text-xs text-muted">个产品</div></div>
            <div><div className="text-2xl font-bold text-accent">{pn._count.rfqs}</div><div className="text-xs text-muted">条询价</div></div>
          </div>
        </div>
      </div>

      {/* 基本信息区 */}
      <div className="bg-white border border-line rounded-lg p-4 md:p-6 mb-6">
        <h2 className="text-lg font-bold mb-3">基本信息</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between sm:block"><dt className="text-muted">件号</dt><dd className="font-mono font-medium text-ink sm:mt-0.5">{pn.number}</dd></div>
          <div className="flex justify-between sm:block"><dt className="text-muted">品牌</dt><dd className="sm:mt-0.5">{pn.brand?.name || "-"}</dd></div>
          <div className="flex justify-between sm:block"><dt className="text-muted">适用设备</dt><dd className="sm:mt-0.5">{equipmentList.length > 0 ? equipmentList.map((e) => e.model).join("、") : "-"}</dd></div>
          <div className="flex justify-between sm:block"><dt className="text-muted">分类</dt><dd className="sm:mt-0.5">{pn.category || "-"}</dd></div>
          <div className="flex justify-between sm:block">
            <dt className="text-muted flex items-center gap-1">
              验证状态
              <span title="该 Part Number 主数据已经过矿配云审核。此状态不代表某一设备适配关系已验证，也不代表原厂授权、库存状态或供应商资质。">
                <HelpCircle size={12} className="text-muted cursor-help" />
              </span>
            </dt>
            <dd className="sm:mt-0.5">{pn.verificationStatus === "VERIFIED" ? <span className="text-brandGreen">已验证</span> : "待验证"}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-muted flex items-center gap-1">最后验证<CalendarCheck size={12} className="text-muted" /></dt>
            <dd className="sm:mt-0.5">{pn.lastVerifiedAt ? formatDate(pn.lastVerifiedAt) : "-"}</dd>
          </div>
        </dl>
      </div>

      {/* P2-1B-2: PN 与设备关系可信度。关系存在不等于适配已经验证。 */}
      <div className="bg-white border border-line rounded-lg p-4 md:p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold">适用设备与关系证据</h2>
          <span className="text-xs text-muted">件号验证与设备适配关系分别审核</span>
        </div>
        {pn.equipmentRelations.length === 0 ? (
          <div className="rounded-md border border-dashed border-line p-4 text-sm text-muted">
            暂无已登记的设备关系。没有设备关系不代表该件号不存在，仅表示当前数据库尚未建立适配关系。
          </div>
        ) : (
          <div className="space-y-3">
            {pn.equipmentRelations.map((relation) => {
              const eq = relation.equipmentModel;
              const relationVerified = relation.verificationStatus === "VERIFIED";
              return (
                <div key={relation.id} className="rounded-lg border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/equipment/${eq.slug}`} className="font-semibold text-accent hover:underline">
                        {eq.model}
                      </Link>
                      <div className="text-sm text-muted mt-0.5">{eq.name}</div>
                    </div>
                    {relationVerified ? (
                      <span className="inline-flex items-center gap-1 text-xs text-brandGreen">
                        <CheckCircle2 size={13} /> 关系已验证
                      </span>
                    ) : (
                      <span className="text-xs text-muted">关系待验证</span>
                    )}
                  </div>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">
                    <div>
                      <dt className="text-muted">证据状态</dt>
                      <dd className="font-medium mt-0.5">{relation.evidenceStatus}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">关系验证</dt>
                      <dd className="mt-0.5">{relationVerified ? <span className="text-brandGreen">已验证</span> : "待验证"}</dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="text-muted">证据摘要</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap">{relation.evidenceSummary || "暂无明确证据摘要"}</dd>
                    </div>
                    {relation.sourceReference && (
                      <div className="md:col-span-2">
                        <dt className="text-muted">来源参考</dt>
                        <dd className="mt-0.5 break-words">{relation.sourceReference}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted mt-3">
          说明：设备关系记录表示数据库中存在该件号与设备型号的关联；只有“关系已验证”才表示该适配关系已经过矿配云审核。
        </p>
      </div>

      {/* 供应商产品 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">可供货产品（{pn.products.length}）</h2>
        {pn.products.length > 0 && (
          <Link href={rfqCreateHref}>
            <Button className="bg-accent text-ink hover:bg-[#d49215] flex items-center gap-1 text-sm">
              <Send size={14} /> 发布询价
            </Button>
          </Link>
        )}
      </div>

      {pn.products.length === 0 ? (
        <div className="bg-white border rounded-lg p-6 md:p-10 text-center">
          <Store size={40} className="mx-auto text-muted mb-3" />
          <p className="text-muted mb-1">暂无供应商发布该件号的供货信息</p>
          <p className="text-sm text-muted mb-5">
            如果您正在采购 <span className="font-mono font-medium text-ink">{pn.number}</span>，可以发布询价，由相关供应商报价。
          </p>
          <Link href={rfqCreateHref}>
            <Button className="bg-accent text-ink hover:bg-[#d49215] flex items-center gap-2 mx-auto">
              <Send size={16} /> 发布询价找货
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* 比较表 */}
          <div className="bg-white border rounded-lg overflow-x-auto mb-4 hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-2">供应商</th>
                  <th className="text-left p-2">类型</th>
                  <th className="text-left p-2">价格</th>
                  <th className="text-left p-2">库存</th>
                  <th className="text-left p-2">交期</th>
                  <th className="text-left p-2">质保</th>
                  <th className="text-left p-2">认证</th>
                </tr>
              </thead>
              <tbody>
                {pn.products.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-2">{p.supplier.shortName || p.supplier.name}</td>
                    <td className="p-2">{TYPE_LABEL[p.productType] || p.productType}</td>
                    <td className="p-2 font-bold text-brandGreen">{p.price ? `¥${p.price.toLocaleString()}` : "询价"}</td>
                    <td className="p-2">{p.stockStatus === "IN_STOCK" ? `现货 ${p.stock || ""}` : p.stockStatus}</td>
                    <td className="p-2">{p.leadTime || "-"}</td>
                    <td className="p-2">{p.warranty || "-"}</td>
                    <td className="p-2">{p.supplier.verifiedStatus === "VERIFIED" ? <span className="text-brandGreen">✓ 已认证</span> : verifiedStatusCN(p.supplier.verifiedStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 产品卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pn.products.map((prod) => (
              <div key={prod.id} className="bg-white border rounded-lg p-4">
                {prod.images ? (
                  <img src={prod.images.split(",")[0]} className="w-full h-36 object-cover rounded mb-3 bg-gray-50" alt={prod.name} />
                ) : (
                  <div className="w-full h-36 rounded mb-3 bg-gray-100 flex items-center justify-center text-gray-300 text-sm">无图片</div>
                )}
                <div className="text-xs text-muted mb-1">Part No. <span className="font-mono font-medium text-ink">{pn.number}</span></div>
                <h3 className="font-medium">{prod.name}</h3>
                <div className="flex items-center gap-1 mt-1 text-sm">
                  <Store size={13} className="text-muted" />
                  <Link href={`/suppliers/${prod.supplier.slug}`} className="text-accent hover:underline">
                    {prod.supplier.shortName || prod.supplier.name}
                  </Link>
                  {prod.supplier.verifiedStatus === "VERIFIED" && <span className="text-xs text-brandGreen">✓</span>}
                </div>
                <div className="flex items-baseline gap-2 mt-3">
                  {prod.price ? <span className="text-xl font-bold text-brandGreen">¥{prod.price.toLocaleString()}</span> : <span className="text-sm text-muted">询价</span>}
                  {prod.leadTime && <span className="text-xs text-muted">{prod.leadTime}</span>}
                </div>
                <div className="flex gap-2 mt-1 text-xs text-muted">
                  {prod.stockStatus === "IN_STOCK" && <span className="text-brandGreen">现货</span>}
                  {prod.warranty && <span>质保 {prod.warranty}</span>}
                </div>
                <div className="flex gap-2 mt-3">
                  <Link href={`/suppliers/${prod.supplier.slug}`} className="flex-1 text-center border rounded py-1.5 text-sm hover:bg-gray-50">查看供应商</Link>
                  <Link
                    href={rfqCreateHref}
                    className="flex-1 text-center bg-accent text-ink rounded py-1.5 text-sm hover:bg-[#d49215] font-medium"
                  >
                    立即询价
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 相关件号 */}
      {relatedParts.length > 0 && (
        <>
          <h2 className="text-lg font-bold mt-8 mb-3">相关件号</h2>
          <div className="flex flex-wrap gap-2">
            {relatedParts.map((rp) => (
              <Link key={rp.id} href={`/part-number/${rp.slug}`}
                className="bg-white border px-3 py-2 rounded text-sm hover:shadow">
                <span className="font-mono">{rp.number}</span>
                {rp.name && <span className="text-muted font-sans ml-1.5">{rp.name}</span>}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
