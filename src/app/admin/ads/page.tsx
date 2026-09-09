export default function AdminAds() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">广告管理</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">首页 Banner</h3>
          <p className="text-sm text-muted">管理首页顶部轮播广告位</p>
        </div>
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">品牌页广告</h3>
          <p className="text-sm text-muted">品牌详情页推荐位</p>
        </div>
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">分类页广告</h3>
          <p className="text-sm text-muted">件号/设备列表页侧边推荐</p>
        </div>
      </div>
    </div>
  );
}
