import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-dark text-[#aeb8c0] py-[38px] mt-12">
      <div className="max-w-[1180px] mx-auto px-[22px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-[30px]">
          <div>
            <div className="font-black text-xl text-white mb-3">
              矿配<span className="text-accent">云</span>
            </div>
            <p className="text-xs leading-[1.8]">
              中国矿山设备与配件专业展示、找货与询价平台。
              <br />
              找设备 · 找配件 · 找厂家 · 发询价
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">找货</h4>
            <Link href="/equipment" className="block text-xs my-2 hover:text-accent">找设备</Link>
            <Link href="/parts" className="block text-xs my-2 hover:text-accent">找配件</Link>
            <Link href="/suppliers" className="block text-xs my-2 hover:text-accent">找厂家</Link>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">供应商</h4>
            <a href="#" className="block text-xs my-2 hover:text-accent">企业入驻</a>
            <a href="#" className="block text-xs my-2 hover:text-accent">会员服务</a>
            <a href="#" className="block text-xs my-2 hover:text-accent">企业认证</a>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">平台</h4>
            <a href="#" className="block text-xs my-2 hover:text-accent">关于我们</a>
            <a href="#" className="block text-xs my-2 hover:text-accent">联系我们</a>
            <a href="#" className="block text-xs my-2 hover:text-accent">服务协议</a>
            <a href="#" className="block text-xs my-2 hover:text-accent">隐私政策</a>
          </div>
        </div>
        <div className="border-t border-white/10 mt-[30px] pt-[18px] text-xs text-slate-400 text-center">
          © 2026 矿配云 Mining Parts Cloud · 中国矿山设备与配件专业平台 | <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" className="hover:text-slate-200">晋ICP备XXXXXXXX号</a>
        </div>
      </div>
    </footer>
  );
}
