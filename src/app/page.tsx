import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, Boxes, ClipboardList, Compass, Handshake, Search, ShieldCheck, Wrench } from "lucide-react";
import HomeSearch from "./HomeSearch";

export const metadata: Metadata = {
  icons: {
    icon: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2212%22%20fill%3D%22%23102a43%22%2F%3E%3Ctext%20x%3D%2232%22%20y%3D%2245%22%20text-anchor%3D%22middle%22%20font-size%3D%2240%22%20font-weight%3D%22800%22%20fill%3D%22%23d59a21%22%3E%E7%9F%BF%3C%2Ftext%3E%3C%2Fsvg%3E",
  },
};

const brands = [
  { name: "Sandvik", image: "1789051585064-nw1ofk.png" },
  { name: "JOY", image: "1789050430950-g13g00.jpg" },
  { name: "CAT", image: "1789051287704-nribr9.png" },
  { name: "Eickhoff", image: "1789051924019-b7osjc.png" },
  { name: "Cummins", image: "1789051657828-mdcw7g.png" },
  { name: "Komatsu", image: "1789051454347-r50t0q.png" },
];

const equipment = [
  { brand: "Sandvik", model: "MB670-1", image: "1789201164646-s2urc3.png" },
  { brand: "Sandvik", model: "LS190", image: "1789204210786-hghm29.png" },
  { brand: "JOY", model: "10SC32", image: "1789203496715-gtsxj5.jpg" },
  { brand: "JOY", model: "12CM15", image: "1789204080394-trwvm0.png" },
  { brand: "Sandvik", model: "LH621i", image: "1789203931236-9x8utd.png" },
];

const values = [
  { icon: Compass, title: "配件档案", english: "Parts Records", text: "有证据的件号·适配证据·来源链接" },
  { icon: Search, title: "技术资料", english: "Technical Resources", text: "零件目录·维修手册·来源引用" },
  { icon: ShieldCheck, title: "设备适配验证", english: "Equipment Fitment", text: "多品牌·多型号 降低选型风险" },
  { icon: Handshake, title: "已验证中国供应商", english: "Verified Chinese Suppliers", text: "真实报价·采购协作 从找件到采购" },
];

const workflow = [
  { title: "找件", english: "Search Parts", text: "通过配件号、设备型号或关键词查找配件" },
  { title: "查适配", english: "Verify Fitment", text: "查看适配设备、替代件及技术资料" },
  { title: "联系供应商", english: "Contact Suppliers", text: "查看已验证的中国供应商，获取供应商信息" },
  { title: "发起询价", english: "Create RFQ", text: "提交采购需求，邀请多个供应商报价" },
  { title: "收到报价", english: "Receive Quotes", text: "比较报价、交期、资质，选择合适供应商" },
];

const navItems = [
  { label: "首页", href: "/" },
  { label: "配件搜索", href: "/search" },
  { label: "设备型号", href: "/equipment" },
  { label: "品牌库", href: "/brands" },
  { label: "供应商", href: "/suppliers" },
  { label: "询价(RFQ)", href: "/rfq" },
];

export default function HomePage() {
  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-container home-header-inner">
          <Link href="/" className="home-brand" aria-label="矿配云首页">
            <span className="home-brand-mark" aria-hidden="true">矿</span>
            <span className="home-brand-copy">矿配云<small>MINING PARTS CLOUD</small></span>
          </Link>
          <nav className="home-nav" aria-label="主导航">
            {navItems.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
          </nav>
          <div className="home-header-actions">
            <Link href="/login" className="home-login">登录</Link>
            <Link href="/register" className="home-header-cta">企业入驻 <ArrowRight size={15} /></Link>
          </div>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-hero-orbit" aria-hidden="true" />
        <div className="home-container home-hero-inner">
          <div className="home-eyebrow"><span />矿山设备 · 配件采购协作平台</div>
          <h1>找矿山配件 · 核实适配 · 连接中国供应商</h1>
          <p className="home-hero-english">Find Mining Parts · Verify Fitment · Source from Verified Chinese Suppliers</p>
          <p className="home-hero-lead">专业的地下采矿设备配件信息与采购协作平台</p>
          <HomeSearch />
          <div className="home-hero-links">
            <Link href="/rfq/create">发布采购需求 <ArrowRight size={15} /></Link>
            <Link href="/equipment">浏览设备目录 <ArrowDownRight size={15} /></Link>
          </div>
          <div className="home-hero-note"><span />围绕真实设备与配件信息，展开采购协作</div>
        </div>
      </section>

      <section className="home-value-strip" aria-label="平台服务">
        <div className="home-container home-value-grid">
          {values.map(({ icon: Icon, title, english, text }) => (
            <article className="home-value-item" key={title}>
              <span className="home-value-icon"><Icon size={20} strokeWidth={1.8} /></span>
              <div><h2>{title}</h2><span className="home-value-english">{english}</span><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <main className="home-container home-content">
        <section className="home-section" aria-labelledby="equipment-title">
          <div className="home-section-heading">
            <div><div className="home-kicker">设备目录 / 热门设备</div><h2 id="equipment-title">从真实设备开始查找</h2><p>查看已核验素材对应的品牌与设备型号。</p></div>
            <Link href="/equipment" className="home-section-link">浏览设备 <ArrowRight size={15} /></Link>
          </div>
          <div className="home-equipment-grid">
            {equipment.map((item) => (
              <Link href="/equipment" className="home-equipment-card" key={item.model}>
                <span className="home-equipment-image"><img src={`/home-assets/${item.image}`} alt={`${item.brand} ${item.model} 设备图片`} /></span>
                <span className="home-equipment-info"><span className="home-equipment-brand">{item.brand}</span><strong>{item.model}</strong><span className="home-card-link">查看设备目录 <ArrowRight size={14} /></span></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-section home-brand-section" aria-labelledby="brands-title">
          <div className="home-section-heading">
            <div><div className="home-kicker">品牌库 / 品牌导航</div><h2 id="brands-title">常见品牌，清晰呈现</h2><p>浏览矿山设备与配件相关品牌信息。</p></div>
            <Link href="/brands" className="home-section-link">浏览品牌 <ArrowRight size={15} /></Link>
          </div>
          <div className="home-brand-grid">
            {brands.map((brand) => (
              <Link href="/brands" className="home-brand-card" key={brand.name} aria-label={`浏览 ${brand.name} 品牌信息`}>
                <span className="home-brand-image"><img src={`/home-assets/${brand.image}`} alt={`${brand.name} 品牌标识`} /></span>
                <span className="home-brand-name">{brand.name}</span>
                <span className="home-card-link">浏览品牌 <ArrowRight size={14} /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-platform-section" aria-labelledby="platform-title">
          <div className="home-platform-copy">
            <div className="home-kicker">采购协作 / 平台价值</div>
            <h2 id="platform-title">让采购需求与供应信息<br /><em>更容易对接</em></h2>
            <p>矿配云提供设备、配件、品牌与供应商信息入口，并支持采购方发布需求、供应商提交报价。</p>
            <Link href="/about" className="home-text-link">了解平台 <ArrowRight size={15} /></Link>
          </div>
          <div className="home-value-card-grid">
            <article><span><Boxes size={21} /></span><h3>信息集中浏览</h3><p>设备、配件和供应商入口清晰组织，便于继续查找。</p></article>
            <article><span><Wrench size={21} /></span><h3>围绕设备查找</h3><p>按设备型号浏览相关信息，辅助识别采购需求。</p></article>
            <article><span><ClipboardList size={21} /></span><h3>需求集中表达</h3><p>通过询价表单描述采购内容，便于供应商了解需求。</p></article>
            <article><span><Handshake size={21} /></span><h3>供需继续沟通</h3><p>采购方与供应商围绕规格、报价和交付细节协作。</p></article>
          </div>
        </section>

        <section className="home-workflow-section" aria-labelledby="workflow-title">
          <div className="home-section-heading">
            <div><div className="home-kicker">采购协作流程</div><h2 id="workflow-title">从需求到沟通，逐步推进</h2></div>
            <Link href="/rfq/create" className="home-section-link">开始发布需求 <ArrowRight size={15} /></Link>
          </div>
          <ol className="home-workflow-grid">
            {workflow.map((step, index) => <li key={step.title}><span className="home-workflow-step">0{index + 1}</span><h3>{step.title}</h3><span className="home-workflow-english">{step.english}</span><p>{step.text}</p></li>)}
          </ol>
        </section>

        <section className="home-bottom-cta">
          <div><div className="home-kicker">矿山设备与配件采购</div><h2>正在寻找合适的设备或配件？</h2><p>整理好型号、件号或产品信息，从目录查找或发布询价开始。</p></div>
          <div className="home-bottom-actions"><Link href="/rfq/create" className="home-primary-button">发布询价 <ArrowRight size={16} /></Link><Link href="/part-number" className="home-secondary-button">查找配件</Link></div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-container">
          <div className="home-footer-main">
            <div className="home-footer-brand"><Link href="/" className="home-brand"><span className="home-brand-mark" aria-hidden="true">矿</span><span className="home-brand-copy">矿配云<small>MINING PARTS CLOUD</small></span></Link><p>中国矿山设备与配件专业展示、找货与询价平台</p></div>
            <div className="home-footer-links"><div><h2>找信息</h2><Link href="/equipment">找设备</Link><Link href="/part-number">找配件</Link><Link href="/suppliers">找厂家</Link></div><div><h2>平台服务</h2><Link href="/rfqs">询价大厅</Link><Link href="/register">企业入驻</Link><Link href="/about">关于我们</Link></div><div><h2>了解更多</h2><Link href="/contact">联系我们</Link><Link href="/terms">服务协议</Link><Link href="/privacy">隐私政策</Link></div></div>
            <div className="home-social"><h2>社交媒体</h2><div className="home-social-placeholders" aria-label="社交媒体入口占位">{[1, 2, 3, 4].map((item) => <span key={item} aria-label={`社媒占位 ${item}`} />)}</div></div>
          </div>
          <div className="home-footer-legal"><span>© 2026 矿配云 Mining Parts Cloud</span><div><a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">晋ICP备2026014393号-1</a><a href="https://beian.mps.gov.cn/#/query/webSearch?code=14060202000233" target="_blank" rel="noreferrer"><img src="/gongan-beian.png" alt="" />晋公网安备14060202000233号</a></div></div>
        </div>
      </footer>
    </div>
  );
}
