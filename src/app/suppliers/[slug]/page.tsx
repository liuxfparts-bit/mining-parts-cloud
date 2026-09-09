import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { CheckCircle2, MapPin, Phone, Mail, Globe, MessageCircle, Clock, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const levelLabel: Record<string, { label: string; className: string }> = {
  GOLD: { label: "金牌供应商", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  SILVER: { label: "银牌供应商", className: "bg-gray-50 text-gray-600 border-gray-200" },
  BRONZE: { label: "铜牌供应商", className: "bg-orange-50 text-orange-700 border-orange-200" },
  FREE: { label: "免费会员", className: "bg-gray-50 text-gray-500 border-gray-200" },
};

export default async function SupplierDetailPage({ params }: { params: { slug: string } }) {
  const s = await prisma.supplier.findUnique({
    where: { slug: params.slug },
    include: {
      products: { include: { partNumber: { include: { equipment: true, brand: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!s) notFound();

  const level = levelLabel[s.memberLevel] || levelLabel.FREE;

  return (
    <div className="container py-[42px]">
      {/* 公司头部 */}
      <div className="bg-white border border-line rounded-lg p-8 mb-8">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 rounded-lg bg-[#eef1f3] flex items-center justify-center text-2xl font-bold shrink-0">
            {(s.shortName || s.name)[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{s.name}</h1>
              {s.verifiedStatus === "VERIFIED" && <CheckCircle2 className="h-5 w-5 text-green" />}
              <Badge variant="outline" className={level.className}>{level.label}</Badge>
            </div>
            {s.nameEn && <p className="text-sm text-muted mt-1">{s.nameEn}</p>}

            {/* 联系信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted mt-4">
              <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {s.province}{s.city ? ` · ${s.city}` : ""}{s.address ? ` · ${s.address}` : ""}</p>
              {s.contactName && <p>👤 {s.contactName}{s.position ? `（${s.position}）` : ""}</p>}
              {s.mobile && <p className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {s.mobile}</p>}
              {s.telephone && <p>☎ {s.telephone}</p>}
              {s.email && <p className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {s.email}</p>}
              {s.website && <p className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> {s.website}</p>}
              {s.wechat && <p className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> 微信: {s.wechat}</p>}
              {s.whatsapp && <p className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp: {s.whatsapp}</p>}
            </div>

            {/* 主营信息 */}
            <div className="mt-4 pt-4 border-t border-line">
              {s.mainBusiness && <p className="text-sm"><b>主营业务：</b>{s.mainBusiness}</p>}
              {s.mainBrands && <p className="text-sm mt-1"><b>主营品牌：</b>{s.mainBrands}</p>}
              {s.mainEquipment && <p className="text-sm mt-1"><b>主营设备：</b>{s.mainEquipment}</p>}
              {s.description && <p className="text-sm text-muted mt-2 leading-relaxed">{s.description}</p>}
            </div>

            {/* 运营数据 */}
            <div className="flex gap-6 mt-4 text-sm flex-wrap">
              <span>产品 <b>{s.products.length}</b></span>
              {s.responseRate && <span>回复率 <b className="text-green">{s.responseRate}%</b></span>}
              <span>浏览 <b>{s.viewCount}</b></span>
              <span>询价 <b>{s.inquiryCount}</b></span>
            </div>

            {/* 联系按钮 */}
            <div className="flex gap-3 mt-5 flex-wrap">
              {s.whatsapp && (
                <a
                  href={`https://wa.me/${s.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 bg-[#25D366] text-white font-bold px-5 py-2.5 rounded-md hover:opacity-90 text-sm"
                >
                  <MessageCircle size={16} /> WhatsApp 联系
                </a>
              )}
              {s.wechat && (
                <button className="inline-flex items-center gap-2 bg-green-600 text-white font-bold px-5 py-2.5 rounded-md hover:opacity-90 text-sm">
                  <MessageCircle size={16} /> 微信: {s.wechat}
                </button>
              )}
              <Link href="/rfq/create">
                <Button className="bg-accent text-ink hover:bg-[#d49215]">
                  <Send size={16} className="mr-1" /> 在线询价
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 供货产品 */}
      <h2 className="text-2xl font-bold mb-4">供货产品（{s.products.length}）</h2>
      <div className="bg-white border border-line rounded-lg overflow-hidden">
        {s.products.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-4 border-b border-line last:border-0">
            <div>
              <Link href={`/part-number/${p.partNumber.slug}`} className="font-mono font-bold text-accent hover:underline">
                {p.partNumber.number}
              </Link>
              <p className="text-sm text-muted">{p.name}</p>
              {p.partNumber.equipment && (
                <p className="text-xs text-muted mt-0.5">适配：{p.partNumber.brand?.name} {p.partNumber.equipment.model}</p>
              )}
            </div>
            <div className="text-right">
              {p.price !== null && <p className="font-bold text-green">¥{p.price.toLocaleString()}</p>}
              {p.leadTime && <p className="text-xs text-muted flex items-center gap-1 justify-end"><Clock className="h-3 w-3" />{p.leadTime}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
