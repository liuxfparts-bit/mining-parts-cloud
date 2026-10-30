import Link from "next/link";
import { ArrowRight, Boxes, BookOpen, ShieldCheck, Users, FileSearch } from "lucide-react";
import HomeSearch from "./HomeSearch";
import { prisma } from "@/lib/prisma";
import { PUBLIC_PN_WHERE } from "@/lib/part-number";
import { publicHomeBannerWhere } from "@/lib/home-banner";

// 首页不再查询供应商列表（PUBLIC-TRUST-STOPGAP-V1）：无法判定供应商是否经过真实审核前，不在首页做推荐。
// 供应商公开条件仍由 /suppliers 列表页自身持有，本页不再复制一份，避免两处规则漂移。
// 首页不调用 auth()：本页无任何登录态分支，公开数据不随会话变化。

export const dynamic = "force-dynamic";

const brandAssets = [
  { name: "Sandvik", image: "1789051585064-nw1ofk.png" }, { name: "JOY", image: "1789050430950-g13g00.jpg" },
  { name: "CAT", image: "1789051287704-nribr9.png" }, { name: "Eickhoff", image: "1789051924019-b7osjc.png" },
  { name: "Cummins", image: "1789051657828-mdcw7g.png" }, { name: "Komatsu", image: "1789051454347-r50t0q.png" },
];
const equipmentAssets = [
  { brand: "Sandvik", model: "MB670-1", image: "1789201164646-s2urc3.png" }, { brand: "Sandvik", model: "LS190", image: "1789204210786-hghm29.png" },
  { brand: "JOY", model: "10SC32", image: "1789203496715-gtsxj5.jpg" }, { brand: "JOY", model: "12CM15", image: "1789204080394-trwvm0.png" },
  { brand: "Sandvik", model: "LH621i", image: "1789203931236-9x8utd.png" },
];
export default async function HomePage() {
  // force-dynamic：每次请求重新查询公开数据，只读、不写库。
  const bannerNow = new Date();

  // 首页只保留"目录级"公开数据：品牌、设备、件号（仅件号/名称/品牌）、banner、分类。
  // 已按 PUBLIC-TRUST-STOPGAP-V1 移除：供应商推荐列表、动态 RFQ 列表、件号卡片的设备适配关系
  // （关系级证据未达公开标准，见 docs/trust/verified-part-number-asset-gate-v1.md §7.2）。
  // 已按 PUBLIC-TRUST-CLOSEOUT-V1 移除：件号卡片的供应商数量与最低价，以及随之无用的 products 关联
  // （产品/供应商数据均未经真实性审核，不参与首页陈述）。
  // 相应死查询（brand._count.equipment、equipment._count.partNumberRelations）一并删除。
  const [brands, equipment, partNumbers, homeBanners, brandsWithEquipment, categories] = await Promise.all([
    prisma.brand.findMany({ where: { status: "ACTIVE" }, include: { _count: { select: { partNumbers: { where: PUBLIC_PN_WHERE } } } }, take: 12, orderBy: { name: "asc" } }),
    prisma.equipment.findMany({ where: { status: "ACTIVE" }, include: { brand: true }, take: 8, orderBy: { id: "asc" } }),
    prisma.partNumber.findMany({ where: PUBLIC_PN_WHERE, include: { brand: true }, take: 6, orderBy: { id: "asc" } }),
    // 公开条件集中在 @/lib/home-banner：status=ACTIVE + position=HOME_TOP + [startAt, endAt] 时间窗。
    prisma.banner.findMany({ where: publicHomeBannerWhere(bannerNow), orderBy: [{ sortOrder: "asc" }, { id: "desc" }] }),
    prisma.brand.findMany({ where: { status: "ACTIVE", equipment: { some: { status: "ACTIVE" } } }, include: { equipment: { where: { status: "ACTIVE" }, take: 6, orderBy: { id: "desc" } } }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ take: 16, orderBy: { sortOrder: "asc" } }),
  ]);

  // 已移除渲染期写库：原实现在每次 GET 渲染时对 impressions +1，且 .catch(() => {}) 静默吞错。
  // 后果是爬虫、预取、健康检查都会计入曝光，admin 端 CTR = clicks / impressions 系统性偏低。
  // 曝光计数需要独立的 beacon 端点 + 去重策略（不在此次 P1 修复范围内，见交付报告"剩余风险"）。

  return (
    <div className="home-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        { "@context": "https://schema.org", "@type": "Organization", name: "矿配云 Mining Parts Cloud", url: "https://kuangpeiyun.com", description: "中国矿山设备与配件专业展示、找货与询价平台" },
        { "@context": "https://schema.org", "@type": "WebSite", name: "矿配云", url: "https://kuangpeiyun.com", potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: "https://kuangpeiyun.com/search?q={search_term_string}" }, "query-input": "required name=search_term_string" } },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "首页", item: "https://kuangpeiyun.com" }] },
      ]) }} />
      <section className="home-hero">
        <div className="home-container home-hero-content">
          <p className="home-eyebrow">专业 · 可靠 · 高效</p>
          <h1>全球地下矿山配件<br />搜索 · 查阅 · 询价 · 采购</h1>
          <p className="home-hero-lead">覆盖 Sandvik、JOY、CAT、Eickhoff 等主流品牌<br />为矿山采购提供配件资料与公开供应商信息</p>
          <HomeSearch />
          <div className="home-hot-searches"><strong>热门搜索：</strong>{["Sandvik LS190", "JOY 10SC32", "MB670", "Eickhoff SL300", "CAT CL210"].map(term => <Link href={"/search?q="+encodeURIComponent(term)} key={term}>{term}</Link>)}</div>
        </div>
        <div className="home-container home-benefits">
          {[{icon:ShieldCheck,title:"地下矿山设备目录",text:"围绕地下采矿设备",href:"/equipment"},{icon:BookOpen,title:"结构化零件资料",text:"查阅件号与来源记录",href:"/part-number"},{icon:Users,title:"公开供应商信息",text:"浏览企业与供货资料",href:"/suppliers"},{icon:FileSearch,title:"采购需求与询价",text:"描述需求，继续沟通",href:"/rfqs"}].map(({icon:Icon,title,text,href})=><Link href={href} className="home-benefit" key={title}><span><Icon size={25} aria-hidden="true"/></span><div><h2>{title}</h2><p>{text}</p></div></Link>)}
        </div>
      </section>
      <div className="home-container home-catalog">
        {homeBanners.length > 0 && <section className="home-banner-strip" aria-label="平台横幅">{homeBanners.map(banner=><a key={banner.id} href={"/api/banner/click/"+banner.id} target="_blank" rel="noreferrer"><img src={banner.imageUrl} alt={banner.title}/></a>)}</section>}
        <section className="home-section" aria-labelledby="home-brands-title">
          <div className="home-section-heading"><div><h2 id="home-brands-title">品牌库 / 热门品牌</h2><p>按品牌查找设备、零件号与配件资料</p></div><Link href="/brands">全部品牌 <ArrowRight size={15}/></Link></div>
          <div className="home-brand-grid">{brandAssets.map(asset=>{const record=brands.find(b=>[b.name,b.nameEn].some(n=>n?.toLowerCase().includes(asset.name.toLowerCase())));return <Link className="home-brand-card" href={record ? "/brands/"+record.slug : "/brands"} key={asset.name}><div className="home-brand-image"><img src={"/home-assets/"+asset.image} alt={asset.name}/></div><h3>{asset.name === "CAT" ? "Caterpillar" : asset.name}</h3><p>{record ? record._count.partNumbers.toLocaleString()+" 个公开件号" : "浏览品牌目录"}</p></Link>})}<Link href="/brands" className="home-brand-card home-brand-more"><span>···</span><h3>更多品牌</h3><p>探索品牌目录</p></Link></div>
        </section>
        <section className="home-section" aria-labelledby="home-equipment-title">
          <div className="home-section-heading"><div><h2 id="home-equipment-title">热门矿山设备</h2><p>按设备型号浏览目录，查找相关零件资料</p></div><Link href="/equipment">全部设备 <ArrowRight size={15}/></Link></div>
          <div className="home-equipment-grid">{[equipmentAssets[1],equipmentAssets[2],equipmentAssets[3],equipmentAssets[0],equipmentAssets[4]].map((asset,i)=>{const record=equipment.find(e=>e.model.toLowerCase()===asset.model.toLowerCase());const names=["井下铲运机 LHD","梭车 Shuttle Car","连续采煤机","掘锚机 Bolter Miner","地下装载设备"];return <Link href={record ? "/equipment/"+record.slug : "/equipment"} className="home-equipment-card" key={asset.model}><div className="home-equipment-image"><img src={"/home-assets/"+asset.image} alt={asset.brand+" "+asset.model}/></div><div className="home-equipment-info"><h3>{names[i]}</h3><p>{asset.brand} {asset.model}</p><small>查看设备目录与资料</small></div><span className="home-card-arrow"><ArrowRight size={16}/></span></Link>})}<Link className="home-equipment-card home-equipment-explore" href="/equipment"><Boxes size={48} strokeWidth={1.2}/><h3>更多矿山设备</h3><p>浏览公开设备目录</p><span className="home-card-arrow"><ArrowRight size={16}/></span></Link></div>
          <p className="home-evidence-note">设备与品牌图片仅作目录展示，不代表具体件号适配结论、供应商授权或资质认证。</p>
        </section>
        <section className="home-section home-parts-section" aria-labelledby="home-parts-title"><div className="home-section-heading"><div><h2 id="home-parts-title">公开零件资料</h2><p>查阅件号、名称与品牌信息</p></div><Link href="/part-number">全部件号 <ArrowRight size={15}/></Link></div><div className="home-parts-grid">{partNumbers.length ? partNumbers.map(part=><Link key={part.id} href={"/part-number/"+part.slug}><span>{part.brand?.name || "品牌信息待补"}</span><h3>{part.number}</h3><p>{part.name}</p><ArrowRight size={17}/></Link>):<p className="home-empty">公开件号资料正在整理，可先浏览设备与品牌目录。</p>}</div></section>
        <section className="home-directory-panel"><div><h2>从设备与分类继续查找</h2><p>适配信息以对应零件资料及来源证据为准。</p></div><div className="home-directory-links">{brandsWithEquipment.slice(0,4).map(brand=><div key={brand.id}><strong>{brand.name}</strong>{brand.equipment.slice(0,4).map(item=><Link key={item.id} href={"/equipment/"+item.slug}>{item.model}</Link>)}</div>)}{categories.length>0 && <div><strong>配件分类</strong>{categories.slice(0,8).map(c=><Link key={c.id} href={"/search?q="+encodeURIComponent(c.name)}>{c.name}</Link>)}</div>}</div></section>
        <section className="home-bottom-cta"><div><h2>让采购需求与供应信息，更容易对接</h2><p>从设备、件号与资料开始，逐步明确您的采购需求。</p></div><Link href="/rfq/create">发布采购需求 <ArrowRight size={17}/></Link></section>
      </div>
      <footer className="home-footer"><div className="home-container"><div className="home-footer-main"><Link href="/" className="home-logo home-logo--wordmark"><img src="/brand/kpy-logo-20261028.png" alt="矿配云 Mining Parts Cloud"/></Link><p>地下矿山设备与配件信息平台</p><nav aria-label="页脚导航"><Link href="/about">关于我们</Link><Link href="/contact">联系我们</Link><Link href="/terms">服务协议</Link><Link href="/privacy">隐私政策</Link></nav></div><div className="home-footer-legal"><span>© 2026 矿配云 Mining Parts Cloud</span><a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">晋ICP备2026014393号-1</a><a href="https://beian.mps.gov.cn/#/query/webSearch?code=14060202000233" target="_blank" rel="noreferrer"><img src="/gongan-beian.png" alt=""/>晋公网安备14060202000233号</a></div></div></footer>
    </div>
  );
}
