import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { approvePartNumberRequest, rejectPartNumberRequest } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPartNumberRequestsPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/login");

  const requests = await prisma.partNumberRequest.findMany({
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">件号申请审核</h1>
      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left p-2">件号</th>
            <th className="text-left p-2">配件名</th>
            <th className="text-left p-2">品牌</th>
            <th className="text-left p-2">设备</th>
            <th className="text-left p-2">申请企业</th>
            <th className="text-left p-2">状态</th>
            <th className="text-left p-2">时间</th>
            <th className="text-left p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2 font-mono font-bold">{r.partNumber}</td>
              <td className="p-2">{r.partName}</td>
              <td className="p-2">{r.brandName}</td>
              <td className="p-2">{r.equipmentModel}</td>
              <td className="p-2">{r.supplier.shortName || r.supplier.name}</td>
              <td className="p-2">
                <span className={
                  r.status === "APPROVED" ? "text-green-600" :
                  r.status === "REJECTED" ? "text-red-600" : "text-amber-600"
                }>{r.status}</span>
                {r.reviewReason && <div className="text-xs text-muted">{r.reviewReason}</div>}
              </td>
              <td className="p-2 text-xs text-muted">{r.createdAt.toLocaleDateString()}</td>
              <td className="p-2">
                {r.status === "PENDING" && (
                  <form action={async () => { "use server"; await approvePartNumberRequest(r.id); }} className="inline">
                    <button className="bg-green-600 text-white px-2 py-1 rounded text-xs mr-1">通过</button>
                  </form>
                )}
                {r.status === "PENDING" && (
                  <form action={async (fd: FormData) => {
                    "use server";
                    await rejectPartNumberRequest(r.id, fd.get("reason") as string);
                  }} className="inline">
                    <input name="reason" placeholder="驳回原因" className="border rounded text-xs px-2 py-1" />
                    <button className="bg-red-600 text-white px-2 py-1 rounded text-xs ml-1">驳回</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {requests.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted">暂无申请</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
