import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "关于矿配云｜Mining Parts Cloud",
  description: "矿配云是中国矿山设备与配件专业展示、找货与询价平台，覆盖山特维克、久益、卡特、艾柯夫等主流品牌。",
};

export default function AboutPage() {
  return (
    <div className="container py-[42px] max-w-[900px]">
      <h1 className="text-3xl font-bold mb-4">关于矿配云</h1>
      <p className="text-muted mb-6">矿配云 Mining Parts Cloud — 中国矿山设备与配件专业展示、找货与询价平台。</p>

      <h2 className="text-xl font-bold mt-8 mb-3">平台定位</h2>
      <p className="leading-relaxed mb-3">
        矿配云面向井下与露天矿山设备采购、维修、备件国产化场景，围绕 <strong>找设备 · 找配件 · 找厂家 · 发询价</strong> 四件事，把品牌、设备型号、件号（Part Number）、产品、供应商和询价串成一条完整链路。
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">核心业务</h2>
      <ul className="list-disc pl-6 space-y-2 leading-relaxed">
        <li><strong>矿山设备</strong>：连续采煤机、锚杆钻车、梭车、地下铲运机、长壁工作面设备等型号库。</li>
        <li><strong>矿山配件 / 件号数据库</strong>：按 OEM 件号、英文名、中文名精准检索，覆盖液压、电气、传动、发动机、结构件等系统。</li>
        <li><strong>供应商对接</strong>：经认证的矿山备件供应商在平台展示企业资质与主营品牌。</li>
        <li><strong>采购询价</strong>：采购方按设备型号 / 件号发起询价，供应商在线报价。</li>
      </ul>

      <h2 className="text-xl font-bold mt-8 mb-3">覆盖品牌</h2>
      <p className="leading-relaxed">山特维克 Sandvik、久益 JOY、卡特 CAT、小松 Komatsu、艾柯夫 Eickhoff、康明斯 Cummins、瓦格纳 Wagner、芬瑞特 Ferrit 等主流矿山设备与发动机品牌。</p>
    </div>
  );
}
