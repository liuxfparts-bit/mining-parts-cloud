import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-8 mt-12">
      <div className="max-w-[1180px] mx-auto px-5">
        {/* 品牌区 */}
        <div className="mb-6">
          <div className="font-black text-xl text-white">
            矿配<span className="text-amber-500">云</span>
            <span className="text-xs font-normal text-slate-400 ml-2 tracking-widest">MINING PARTS CLOUD</span>
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            中国矿山设备与配件专业展示、找货与询价平台
          </p>
        </div>

        {/* 三列链接：现货 / 供应商 / 平台 */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <h4 className="text-white font-bold text-sm mb-3">现货</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/equipment" className="hover:text-amber-400">找设备</Link></li>
              <li><Link href="/part-number" className="hover:text-amber-400">找配件</Link></li>
              <li><Link href="/suppliers" className="hover:text-amber-400">找厂家</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-3">供应商</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/register" className="hover:text-amber-400">企业入驻</Link></li>
              <li><Link href="/membership" className="hover:text-amber-400">会员服务</Link></li>
              <li><Link href="/certification" className="hover:text-amber-400">企业认证</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-3">平台</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/about" className="hover:text-amber-400">关于我们</Link></li>
              <li><Link href="/contact" className="hover:text-amber-400">联系我们</Link></li>
              <li><Link href="/terms" className="hover:text-amber-400">服务协议</Link></li>
              <li><Link href="/privacy" className="hover:text-amber-400">隐私政策</Link></li>
            </ul>
          </div>
        </div>

        {/* 版权行 */}
        <div className="border-t border-white/10 mt-6 pt-4 text-xs text-slate-400 text-center leading-relaxed">
          <p>© 2026 矿配云 Mining Parts Cloud · 中国矿山设备与配件专业询价平台</p>
          <p className="mt-1">
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" className="hover:text-slate-200">晋ICP备XXXXXXXX号</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
