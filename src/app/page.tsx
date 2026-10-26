import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, Boxes, ClipboardList, Compass, Handshake, Search, Wrench } from "lucide-react";
import HomeSearch from "./HomeSearch";
import { prisma } from "@/lib/prisma";
import { PUBLIC_PN_WHERE } from "@/lib/part-number";
import { publicHomeBannerWhere } from "@/lib/home-banner";

// 首页不再查询供应商列表（PUBLIC-TRUST-STOPGAP-V1）：无法判定供应商是否经过真实审核前，不在首页做推荐。
// 供应商公开条件仍由 /suppliers 列表页自身持有，本页不再复制一份，避免两处规则漂移。
// 首页不调用 auth()：本页无任何登录态分支，公开数据不随会话变化。

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  icons: { icon: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2212%22%20fill%3D%22%23102a43%22%2F%3E%3Ctext%20x%3D%2232%22%20y%3D%2245%22%20text-anchor%3D%22middle%22%20font-size%3D%2240%22%20font-weight%3D%22800%22%20fill%3D%22%23d59a21%22%3E%E7%9F%BF%3C%2Ftext%3E" },
};

const hotSearches = ["掘进机", "采煤机", "轴承", "连续采煤机", "电子围栏"];
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
const values = [
  { icon: Compass, title: "配件档案", english: "Parts Records", text: "有证据的件号·来源引用·资料归档" },
  { icon: Search, title: "技术资料", english: "Technical Resources", text: "零件目录·维修手册·来源引用" },
  { icon: Boxes, title: "设备目录浏览", english: "Equipment Catalog", text: "多品牌·多型号目录入口，不含具体件号适配结论" },
  { icon: Handshake, title: "公开供应商信息", english: "Public Supplier Profiles", text: "通过供应商目录查看平台公开资料" },
];
const workflow = [
  { title: "找件", english: "Search Parts", text: "通过配件号、设备型号或关键词查找配件" },
  { title: "查资料", english: "Check Records", text: "查看配件资料、替代件与来源引用，适配结论以对应资料为准" },
  { title: "查看供应商", english: "View Suppliers", text: "在供应商目录查看平台公开资料，获取联系入口" },
  { title: "发起询价", english: "Create RFQ", text: "提交采购需求，邀请供应商报价" },
  { title: "收到报价", english: "Receive Quotes", text: "比较报价、交期与资料，选择合适供应商" },
];
const navItems = [
  { label: "首页", href: "/" }, { label: "配件搜索", href: "/search" }, { label: "设备型号", href: "/equipment" },
  { label: "品牌库", href: "/brands" }, { label: "供应商", href: "/suppliers" }, { label: "询价(RFQ)", href: "/rfq" },
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
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        { "@context": "https://schema.org", "@type": "Organization", name: "矿配云 Mining Parts Cloud", url: "https://kuangpeiyun.com", description: "中国矿山设备与配件专业展示、找货与询价平台" },
        { "@context": "https://schema.org", "@type": "WebSite", name: "矿配云", url: "https://kuangpeiyun.com", potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: "https://kuangpeiyun.com/search?q={search_term_string}" }, "query-input": "required name=search_term_string" } },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "首页", item: "https://kuangpeiyun.com" }] },
      ]) }} />
      <div className="home-page">
        <header className="home-header"><div className="home-container home-header-inner">
          <Link href="/" className="home-brand" aria-label="矿配云首页"><span className="home-brand-mark" aria-hidden="true">矿</span><span className="home-brand-copy">矿配云<small>MINING PARTS CLOUD</small></span></Link>
          <nav className="home-nav" aria-label="主导航">{navItems.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
          <div className="home-header-actions"><Link href="/login" className="home-login">登录</Link><Link href="/register" className="home-header-cta">企业入驻 <ArrowRight size={15} /></Link></div>
        </div></header>

        <section className="home-hero"><div className="home-hero-orbit" aria-hidden="true" /><div className="home-container home-hero-inner">
          <div className="home-eyebrow"><span />矿山设备 · 配件采购协作平台</div>
          <h1>找矿山配件 · 查阅适配资料 · 连接中国供应商</h1><p className="home-hero-english">Find Mining Parts · Check Fitment Records · Source from Public Supplier Profiles</p>
          <p className="home-hero-lead">专业的地下采矿设备配件信息与采购协作平台</p><HomeSearch />
          <div className="home-live-inline home-hot-searches"><strong>热门搜索</strong><div className="home-live-chip-list">{hotSearches.map((term) => <Link key={term} href={"/search?q=" + encodeURIComponent(term)}>{term}</Link>)}</div></div>
          <div className="home-hero-links"><Link href="/rfq/create">发布采购需求 <ArrowRight size={15} /></Link><Link href="/equipment">浏览设备目录 <ArrowDownRight size={15} /></Link></div>
          <div className="home-hero-note"><span />图片素材来源核验不代表配件适配结论或供应商资质认证</div>
        </div></section>

        {homeBanners.length > 0 && <section className="home-banner-strip" aria-label="平台横幅"><div className="home-container">{homeBanners.map((banner) => <a key={banner.id} href={"/api/banner/click/" + banner.id} target="_blank" rel="noreferrer" className="home-banner-link"><img src={banner.imageUrl} alt={banner.title} /></a>)}</div></section>}

        <section className="home-value-strip" aria-label="平台服务"><div className="home-container home-value-grid">{values.map(({ icon: Icon, title, english, text }) => <article className="home-value-item" key={title}><span className="home-value-icon"><Icon size={20} strokeWidth={1.8} /></span><div><h2>{title}</h2><span className="home-value-english">{english}</span><p>{text}</p></div></article>)}</div></section>

        <div className="home-container home-content">
          <section className="home-section" aria-labelledby="equipment-title"><div className="home-section-heading"><div><div className="home-kicker">设备目录 / 图片素材展示</div><h2 id="equipment-title">从品牌与设备目录开始查找</h2><p>图片用于品牌和设备展示，不代表配件适配结论；适配信息以对应配件资料为准。</p></div><Link href="/equipment" className="home-section-link">浏览设备 <ArrowRight size={15} /></Link></div>
            <div className="home-equipment-grid">{equipmentAssets.map((item) => <Link href="/equipment" className="home-equipment-card" key={item.model}><span className="home-equipment-image"><img src={"/home-assets/" + item.image} alt={item.brand + " " + item.model + " 设备图片素材"} /></span><span className="home-equipment-info"><span className="home-equipment-brand">{item.brand}</span><strong>{item.model}</strong><span className="home-card-link">打开设备目录 <ArrowRight size={14} /></span></span></Link>)}</div>
            {equipment.length > 0 && <div className="home-live-inline" aria-label="当前设备目录"><strong>当前设备目录</strong><div className="home-live-chip-list">{equipment.map((item) => <Link key={item.id} href={"/equipment/" + item.slug}>{item.brand.name} {item.model}</Link>)}</div></div>}
          </section>

          <section className="home-section home-brand-section" aria-labelledby="brands-title"><div className="home-section-heading"><div><div className="home-kicker">品牌库 / 品牌标识展示</div><h2 id="brands-title">常见品牌，清晰呈现</h2><p>品牌图片仅作品牌识别展示，不代表供应商关系或资质。</p></div><Link href="/brands" className="home-section-link">浏览品牌 <ArrowRight size={15} /></Link></div>
            <div className="home-brand-grid">{brandAssets.map((brand) => <Link href="/brands" className="home-brand-card" key={brand.name} aria-label={"浏览 " + brand.name + " 品牌信息"}><span className="home-brand-image"><img src={"/home-assets/" + brand.image} alt={brand.name + " 品牌标识素材"} /></span><span className="home-brand-name">{brand.name}</span><span className="home-card-link">浏览品牌 <ArrowRight size={14} /></span></Link>)}</div>
            {brands.length > 0 && <div className="home-live-inline" aria-label="当前品牌数据"><strong>当前公开品牌与件号</strong><div className="home-live-chip-list">{brands.map((brand) => <Link key={brand.id} href={"/brands/" + brand.slug}>{brand.name} · {brand._count.partNumbers} 件号</Link>)}</div></div>}
          </section>

          <section className="home-platform-section" aria-labelledby="platform-title"><div className="home-platform-copy"><div className="home-kicker">采购协作 / 平台价值</div><h2 id="platform-title">让采购需求与供应信息<br /><em>更容易对接</em></h2><p>平台提供设备、配件、品牌与公开供应商信息入口，并支持采购方发布需求、供应商提交报价。</p><Link href="/about" className="home-text-link">了解平台 <ArrowRight size={15} /></Link></div><div className="home-value-card-grid"><article><span><Boxes size={21} /></span><h3>信息集中浏览</h3><p>设备、配件和供应商入口清晰组织，便于继续查找。</p></article><article><span><Wrench size={21} /></span><h3>围绕设备查找</h3><p>按设备型号浏览相关信息，辅助识别采购需求。</p></article><article><span><ClipboardList size={21} /></span><h3>需求集中表达</h3><p>通过询价表单描述采购内容，便于供应商了解需求。</p></article><article><span><Handshake size={21} /></span><h3>供需继续沟通</h3><p>采购方与供应商围绕规格、报价和交付细节协作。</p></article></div></section>

          <section className="home-section" aria-labelledby="category-title"><div className="home-section-heading"><div><div className="home-kicker">实时目录</div><h2 id="category-title">从分类与配件继续查找</h2><p>内容来自生产基线的公开目录查询。</p></div><Link href="/search" className="home-section-link">配件搜索 <ArrowRight size={15} /></Link></div>
            <div className="home-live-panel"><h3>热门搜索</h3><div className="home-live-chip-list">{hotSearches.map((term) => <Link key={term} href={"/search?q=" + encodeURIComponent(term)}>{term}</Link>)}</div><h3 className="home-live-subheading">配件分类</h3>{categories.length > 0 ? <div className="home-live-chip-list">{categories.map((category) => <Link key={category.id} href={"/search?q=" + encodeURIComponent(category.name)}>{category.name}</Link>)}</div> : <p className="home-live-empty">数据库暂无分类，请先在后台添加配件分类。</p>}</div>
            {/* 件号卡片只陈述件号、名称与品牌（PUBLIC-TRUST-CLOSEOUT-V1）：供应商数量与价格涉及未经审核的产品/供应商数据，首页不展示。 */}
            <div className="home-live-grid home-live-grid--3">{partNumbers.map((part) => <Link key={part.id} href={"/part-number/" + part.slug} className="home-live-card"><strong className="home-live-part-number">{part.number}</strong><span>{part.name}</span><small>{part.brand?.name || "品牌信息待补"}</small></Link>)}</div>
          </section>

          <section className="home-section" aria-labelledby="fitment-title"><div className="home-section-heading"><div><div className="home-kicker">设备目录 / 按品牌浏览</div><h2 id="fitment-title">按设备品牌浏览型号</h2><p>以下为公开设备目录中的品牌与型号，不代表具体件号的适配结论。</p></div><Link href="/equipment" className="home-section-link">全部设备 <ArrowRight size={15} /></Link></div><div className="home-live-panel">{brandsWithEquipment.map((brand) => <div className="home-fitment-row" key={brand.id}><strong>{brand.name}</strong><div className="home-live-chip-list">{brand.equipment.length > 0 ? brand.equipment.map((item) => <Link key={item.id} href={"/equipment/" + item.slug}>{item.model}</Link>) : <span>暂无设备</span>}</div></div>)}</div></section>

          <section className="home-section" aria-labelledby="rfq-title"><div className="home-section-heading"><div><div className="home-kicker">询价协作</div><h2 id="rfq-title">询价大厅</h2></div><Link href="/rfqs" className="home-section-link">进入询价大厅 <ArrowRight size={15} /></Link></div><div className="home-live-panel"><p>公开询价与报价进展请在询价大厅查看；发布采购需求后可邀请供应商报价。首页不再展示动态询价列表。</p><div className="home-live-chip-list"><Link href="/rfqs">进入询价大厅</Link><Link href="/rfq/create">发布采购需求</Link></div></div></section>

          <section className="home-section" aria-labelledby="supplier-title"><div className="home-section-heading"><div><div className="home-kicker">供应商目录</div><h2 id="supplier-title">公开供应商资料</h2><p>供应商资料与公开供货产品请在供应商目录查看。</p></div><Link href="/suppliers" className="home-section-link">全部供应商 <ArrowRight size={15} /></Link></div><div className="home-live-panel"><p>平台在此不展示供应商推荐列表，也不对供应商资质作额外承诺；具体资料以供应商目录页为准。</p><div className="home-live-chip-list"><Link href="/suppliers">进入供应商目录</Link></div></div></section>

          <section className="home-workflow-section" aria-labelledby="workflow-title"><div className="home-section-heading"><div><div className="home-kicker">采购协作流程</div><h2 id="workflow-title">从需求到沟通，逐步推进</h2></div><Link href="/rfq/create" className="home-section-link">开始发布需求 <ArrowRight size={15} /></Link></div><ol className="home-workflow-grid">{workflow.map((step, index) => <li key={step.title}><span className="home-workflow-step">0{index + 1}</span><h3>{step.title}</h3><span className="home-workflow-english">{step.english}</span><p>{step.text}</p></li>)}</ol></section>

          <section className="home-bottom-cta"><div><div className="home-kicker">矿山设备与配件采购</div><h2>正在寻找合适的设备或配件？</h2><p>整理好型号、件号或产品信息，从目录查找或发布询价开始。</p></div><div className="home-bottom-actions"><Link href="/rfq/create" className="home-primary-button">发布询价 <ArrowRight size={16} /></Link><Link href="/part-number" className="home-secondary-button">查找配件</Link></div></section>
        </div>

        <footer className="home-footer"><div className="home-container"><div className="home-footer-main"><div className="home-footer-brand"><Link href="/" className="home-brand"><span className="home-brand-mark" aria-hidden="true">矿</span><span className="home-brand-copy">矿配云<small>MINING PARTS CLOUD</small></span></Link><p>中国矿山设备与配件专业展示、找货与询价平台</p></div><div className="home-footer-links"><div><h2>找信息</h2><Link href="/equipment">找设备</Link><Link href="/part-number">找配件</Link><Link href="/suppliers">找厂家</Link></div><div><h2>平台服务</h2><Link href="/rfqs">询价大厅</Link><Link href="/register">企业入驻</Link><Link href="/about">关于我们</Link></div><div><h2>了解更多</h2><Link href="/contact">联系我们</Link><Link href="/terms">服务协议</Link><Link href="/privacy">隐私政策</Link></div></div><div className="home-social"><h2>社交媒体</h2><div className="home-social-placeholders" aria-label="社交媒体入口占位">{[1, 2, 3, 4].map((item) => <span key={item} aria-label={"社媒占位 " + item} />)}</div></div></div><div className="home-footer-legal"><span>© 2026 矿配云 Mining Parts Cloud</span><div><a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">晋ICP备2026014393号-1</a><a href="https://beian.mps.gov.cn/#/query/webSearch?code=14060202000233" target="_blank" rel="noreferrer"><img src="/gongan-beian.png" alt="" />晋公网安备14060202000233号</a></div></div></div></footer>
      </div>
    </>
  );
}
