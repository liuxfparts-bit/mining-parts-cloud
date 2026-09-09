export const dynamic = 'force-dynamic';

export default function AdminAds() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">骞垮憡绠＄悊</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">棣栭〉 Banner</h3>
          <p className="text-sm text-muted">绠＄悊棣栭〉椤堕儴杞挱骞垮憡浣?/p>
        </div>
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">鍝佺墝椤靛箍鍛?/h3>
          <p className="text-sm text-muted">鍝佺墝璇︽儏椤垫帹鑽愪綅</p>
        </div>
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-bold mb-2">鍒嗙被椤靛箍鍛?/h3>
          <p className="text-sm text-muted">浠跺彿/璁惧鍒楄〃椤典晶杈规帹鑽?/p>
        </div>
      </div>
    </div>
  );
}

