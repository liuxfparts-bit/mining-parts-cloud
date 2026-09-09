export default function RegisterPage() {
  const steps = [
    { num: "01", title: "企业信息", desc: "公司名称、营业执照" },
    { num: "02", title: "联系方式", desc: "联系人、电话、邮箱" },
    { num: "03", title: "主营品牌", desc: "Sandvik / CAT / JOY" },
    { num: "04", title: "主营设备", desc: "MB670 / LS190 / 10SC32" },
    { num: "05", title: "主营产品", desc: "液压件 / 传动件 / 电气件" },
    { num: "06", title: "企业介绍", desc: "公司简介、工厂照片" },
    { num: "07", title: "上传产品", desc: "上传10个产品开始获客" },
  ];

  return (
    <div className="container py-[42px]">
      <div className="max-w-[800px] mx-auto">
        {/* 标题 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-3">免费入驻矿配云</h1>
          <p className="text-lg text-muted">展示您的矿山设备与配件业务</p>
        </div>

        {/* 步骤 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {steps.map((s) => (
            <div key={s.num} className="bg-white border border-line rounded-lg p-4 text-center">
              <div className="text-accent font-bold text-lg">{s.num}</div>
              <div className="text-sm font-bold mt-1">{s.title}</div>
              <div className="text-xs text-muted mt-1">{s.desc}</div>
            </div>
          ))}
        </div>

        {/* 免费权益 */}
        <div className="bg-white border border-line rounded-lg p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">免费企业版权益</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><span className="text-green">✓</span> 免费建立企业主页</div>
            <div className="flex items-center gap-2"><span className="text-green">✓</span> 上传 10 个产品</div>
            <div className="flex items-center gap-2"><span className="text-green">✓</span> 接收采购询价</div>
            <div className="flex items-center gap-2"><span className="text-green">✓</span> 提交报价</div>
          </div>
          <p className="text-xs text-muted mt-4">后续升级：认证企业 / VIP企业 / 广告会员</p>
        </div>

        {/* 注册表单 */}
        <div className="bg-white border border-line rounded-lg p-8">
          <h2 className="text-xl font-bold mb-6">创建账号</h2>
          <div className="space-y-4 max-w-[400px]">
            <input className="w-full border rounded-md px-3 py-2.5 text-sm" placeholder="企业全称" />
            <input className="w-full border rounded-md px-3 py-2.5 text-sm" placeholder="联系人姓名" />
            <input className="w-full border rounded-md px-3 py-2.5 text-sm" placeholder="手机号 / WhatsApp" />
            <input className="w-full border rounded-md px-3 py-2.5 text-sm" placeholder="工作邮箱" type="email" />
            <input className="w-full border rounded-md px-3 py-2.5 text-sm" placeholder="设置密码" type="password" />
            <button className="w-full bg-accent text-ink font-bold py-3 rounded-md hover:bg-[#d49215] transition-colors">
              免费注册并入驻
            </button>
          </div>
          <p className="text-xs text-muted text-center mt-4">
            已有账号？<a href="/login" className="text-accent">立即登录</a>
          </p>
        </div>
      </div>
    </div>
  );
}
