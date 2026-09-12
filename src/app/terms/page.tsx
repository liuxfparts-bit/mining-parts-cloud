import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "服务协议｜矿配云",
  description: "矿配云平台服务协议。",
};

export default function TermsPage() {
  return (
    <div className="container py-[42px] max-w-[900px] leading-relaxed">
      <h1 className="text-3xl font-bold mb-4">服务协议</h1>
      <p className="text-muted mb-6">更新日期：2026 年 1 月 1 日</p>

      <h2 className="text-xl font-bold mt-6 mb-2">一、服务说明</h2>
      <p>矿配云（Mining Parts Cloud）是矿山设备与配件信息展示与询价对接平台，为采购方与供应商提供信息发布、检索、询价与报价对接服务。平台本身不直接销售商品、不承担买卖双方交易担保责任。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">二、用户注册</h2>
      <p>用户应按注册流程提供真实、准确、完整的企业与联系人信息。因信息不实造成的后果由用户自行承担。账号仅限本人 / 本企业使用，不得转借、出租或出售。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">三、企业入驻</h2>
      <p>供应商入驻需提交营业执照、主营品牌、主营设备等资料。平台对资料进行审核，审核通过后展示认证标识。企业应对其提交资料的真实性、合法性负责。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">四、信息发布</h2>
      <p>用户在平台发布的产品、件号、企业介绍、询价等内容应真实、合法，不得包含侵权、虚假、误导或违反法律法规的信息。平台有权对违规内容进行下架或删除。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">五、询价与报价</h2>
      <p>采购方发布的询价（RFQ）内容（件号、数量、交期等）应真实有效。供应商根据自身能力进行报价。最终价格、交付、付款等交易条款由买卖双方自行协商并签订合同，平台不介入具体交易。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">六、供应商责任</h2>
      <p>供应商应对其发布的产品信息、报价、供货能力、资质文件真实性负责，并按与采购方约定履行交付义务。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">七、买家责任</h2>
      <p>采购方应对其发布的询价需求真实性、采购用途合法性负责，并尊重供应商报价与知识产权。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">八、知识产权</h2>
      <p>平台名称、Logo、页面设计、数据库结构等受法律保护。用户在平台上传的内容知识产权归原权利人所有。未经授权，不得复制、抓取、转载平台数据。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">九、信息真实性</h2>
      <p>平台已尽合理努力维护信息准确性，但不对第三方发布信息（产品参数、价格、库存等）作明示或默示担保。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">十、免责声明</h2>
      <p>因不可抗力、网络故障、第三方原因导致的服务中断或数据损失，平台在法律允许范围内不承担责任。买卖双方因交易产生的纠纷应自行解决。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">十一、服务变更</h2>
      <p>平台有权根据业务发展调整服务内容、收费方式或功能模块，并通过站内通知或公告形式告知用户。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">十二、协议修改</h2>
      <p>本协议修订后在本页公布即生效。用户继续使用平台服务即视为接受修订后的协议。</p>
    </div>
  );
}
