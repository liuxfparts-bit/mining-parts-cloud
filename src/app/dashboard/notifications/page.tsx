export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markNotificationsRead } from "./actions";
import { Bell } from "lucide-react";

export default async function BuyerNotificationsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const s = await auth();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: String((s.user as any).email).toLowerCase() },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const pageSize = 20;
  const page = Math.max(1, parseInt(searchParams.page || "1") || 1);
  const total = await prisma.notification.count({ where: { userId: user.id } });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // 标记已读（server action form）
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">消息通知</h1>
          <p className="text-sm text-slate-500 mt-0.5">共 {total} 条通知</p>
        </div>
        {hasUnread && (
          <form action={markNotificationsRead}>
            <button className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700">
              全部标记为已读
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center text-sm text-slate-400">
          <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          暂无通知
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm divide-y divide-slate-100">
          {notifications.map((n) => (
            <div key={n.id} className={`px-4 py-3 flex gap-3 ${n.readAt ? "opacity-60" : "bg-blue-50/30"}`}>
              <span
                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? "bg-slate-200" : "bg-blue-500"}`}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800">{n.title}</div>
                {n.content && <div className="text-xs text-slate-500 mt-0.5">{n.content}</div>}
                <div className="text-[11px] text-slate-300 mt-1">
                  {new Date(n.createdAt).toLocaleString("zh-CN")} · {n.type}
                </div>
                {n.link && (
                  <a href={n.link} className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                    查看详情 →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            第 {page} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/dashboard/notifications?page=${page - 1}`}
                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-700"
              >
                上一页
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/dashboard/notifications?page=${page + 1}`}
                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-700"
              >
                下一页
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
