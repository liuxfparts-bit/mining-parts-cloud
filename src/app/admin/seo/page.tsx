export const dynamic = 'force-dynamic';

export default function AdminSeo() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">SEO 管理</h1>
      <div className="bg-white border rounded-lg p-6">
        <p className="text-gray-500 mb-4">已自动生成：robots.txt、sitemap.xml</p>
        <p className="text-gray-500">各详情页 Meta Title / Description 从数据库 seoTitle / seoDescription 字段自动读取。</p>
      </div>
    </div>
  );
}
