import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隐私政策｜矿配云",
  description: "矿配云隐私政策。",
};

export default function PrivacyPage() {
  return (
    <div className="container py-[42px] max-w-[900px] leading-relaxed">
      <h1 className="text-3xl font-bold mb-4">隐私政策</h1>
      <p className="text-muted mb-6">更新日期：2026 年 1 月 1 日</p>

      <h2 className="text-xl font-bold mt-6 mb-2">一、我们收集的信息</h2>
      <p>为完成注册、询价、报价与企业入驻，我们可能收集：注册邮箱 / 手机号、企业名称、联系人姓名与职务、营业执照、主营品牌与设备、询价与报价记录、登录 IP 与浏览器信息。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">二、信息使用</h2>
      <p>信息用于：账号开通、企业认证、匹配询价与供应商、平台必要通知、安全风控与产品改进。我们不会将您的个人信息出售给无关第三方。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">三、注册与登录</h2>
      <p>注册时需提供邮箱或手机号及密码。密码以加密形式存储，不会以明文展示。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">四、企业资料</h2>
      <p>企业名称、Logo、认证状态、主营品牌、产品与件号等信息经审核后在前台公开展示，用于买卖双方对接。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">五、询价与报价</h2>
      <p>采购方发布的询价标题、件号、数量、交期等信息将展示给经认证的供应商。供应商报价内容仅采购方与对应供应商可见。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">六、联系方式</h2>
      <p>为完成商务对接，采购方可查看其主动选择对接的供应商联系方式，反之亦然。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">七、Cookies</h2>
      <p>我们使用必要的 Cookies 维持登录态与站点偏好。您可通过浏览器设置清除或阻止 Cookies，但可能影响部分功能使用。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">八、数据安全</h2>
      <p>我们采用加密传输、访问控制、定期备份等措施保护数据。尽管如此，互联网传输无法保证 100% 安全。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">九、信息共享</h2>
      <p>除以下情形外，我们不会向第三方共享您的个人信息：取得您的明确同意；为完成询价对接所必需；法律法规要求。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">十、您的权利</h2>
      <p>您可以访问、更正、删除您的企业资料与询价记录，或注销账号。相关请求可通过平台联系我们提交。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">十一、联系我们</h2>
      <p>如有隐私相关问题，请通过"联系我们"页面与我们沟通。</p>

      <h2 className="text-xl font-bold mt-6 mb-2">十二、政策更新</h2>
      <p>本政策更新后将在本页公布，继续使用平台即视为接受更新内容。</p>
    </div>
  );
}
