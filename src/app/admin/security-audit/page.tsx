export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

export default async function SecurityAuditPage({
  searchParams,
}: {
  searchParams: { action?: string; page?: string };
}) {
  const action = (searchParams.action || "").trim();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 50;
  const where = action ? { action: { contains: action, mode: "insensitive" as const } } : {};
  const [total, logs] = await Promise.all([
    prisma.securityAuditLog.count({ where }),
    prisma.securityAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const actorIds = [...new Set(logs.map((x) => x.actorUserId).filter((x): x is number => x != null))];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true, name: true } }) : [];
  const actorMap = new Map(actors.map((x) => [x.id, x]));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hrefFor = (p: number) => "/admin/security-audit?page=" + p + (action ? "&action=" + encodeURIComponent(action) : "");

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">安全与管理员审计（共 {total}）</h1>
      <form className="mb-4 flex gap-2">
        <input name="action" defaultValue={action} placeholder="按 action 搜索" className="border rounded px-3 py-1.5 text-sm" />
        <button className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm">搜索</button>
      </form>
      <div className="overflow-x-auto bg-white border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr><th className="text-left p-3">时间</th><th className="text-left p-3">操作人</th><th className="text-left p-3">动作</th><th className="text-left p-3">对象</th><th className="text-left p-3">说明</th></tr></thead>
          <tbody>{logs.map((log) => {
            const actor = log.actorUserId ? actorMap.get(log.actorUserId) : null;
            const actorLabel = actor ? actor.name + " (" + actor.email + ")" : (log.actorUserId ? "User #" + log.actorUserId : "SYSTEM");
            const targetLabel = log.targetType + (log.targetId ? " #" + log.targetId : "");
            return <tr key={log.id} className="border-b align-top"><td className="p-3 whitespace-nowrap">{log.createdAt.toLocaleString("zh-CN")}</td><td className="p-3">{actorLabel}</td><td className="p-3 font-mono text-xs">{log.action}</td><td className="p-3">{targetLabel}</td><td className="p-3">{log.summary || "-"}</td></tr>;
          })}</tbody>
        </table>
      </div>
      <div className="mt-4 flex gap-2 text-sm">
        {page > 1 && <a className="border rounded px-3 py-1" href={hrefFor(page - 1)}>上一页</a>}
        <span className="px-2 py-1">第 {page} / {totalPages} 页</span>
        {page < totalPages && <a className="border rounded px-3 py-1" href={hrefFor(page + 1)}>下一页</a>}
      </div>
    </div>
  );
}
