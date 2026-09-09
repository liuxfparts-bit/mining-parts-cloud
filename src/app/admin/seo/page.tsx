export const dynamic = 'force-dynamic';

export default function AdminSEO() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">SEO 绠＄悊</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">椤甸潰 Meta</h3>
          <p className="text-sm text-muted">绠＄悊棣栭〉銆佽澶囬〉銆佷欢鍙烽〉鐨?title 鍜?description</p>
        </div>
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">Sitemap</h3>
          <p className="text-sm text-muted">鐢熸垚骞舵洿鏂?sitemap.xml</p>
        </div>
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">URL 瑙勫垯</h3>
          <p className="text-sm text-muted">绠＄悊鑷畾涔?URL 鍜岄噸瀹氬悜</p>
        </div>
      </div>
    </div>
  );
}

