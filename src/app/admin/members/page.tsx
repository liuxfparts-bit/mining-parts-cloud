export const dynamic = 'force-dynamic';

export default function AdminMembers() {
  const levels = [
    { name: "FREE", desc: "免费企业：企业主页 + 10个产品", color: "gray" },
    { name: "BRONZE", desc: "铜牌企业：产品优先展示", color: "orange" },
    { name: "SILVER", desc: "银牌企业：首页展示 + 置顶", color: "gray" },
    { name: "GOLD", desc: "金牌企业：全部权益 + RFQ优先匹配", color: "yellow" },
  ];
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">会员等级</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {levels.map((l) => (
          <div key={l.name} className="bg-white border rounded-lg p-6">
            <span className={`px-2 py-1 bg-${l.color}-100 text-${l.color}-700 rounded text-sm font-medium`}>{l.name}</span>
            <p className="text-sm text-gray-600 mt-2">{l.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
