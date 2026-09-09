export default function AdminSEO() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">SEO 管理</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">页面 Meta</h3>
          <p className="text-sm text-muted">管理首页、设备页、件号页的 title 和 description</p>
        </div>
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">Sitemap</h3>
          <p className="text-sm text-muted">生成并更新 sitemap.xml</p>
        </div>
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">URL 规则</h3>
          <p className="text-sm text-muted">管理自定义 URL 和重定向</p>
        </div>
      </div>
    </div>
  );
}
