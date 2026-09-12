import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SupplierRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id }, select: { supplierId: true } });
  if (!user?.supplierId) redirect("/register");

  const [pnRequests, eqRequests] = await Promise.all([
    prisma.partNumberRequest.findMany({ where: { supplierId: user.supplierId }, orderBy: { createdAt: "desc" } }),
    prisma.equipmentRequest.findMany({ where: { supplierId: user.supplierId }, orderBy: { createdAt: "desc" } }),
  ]);

  const statusTag = (s: string) => (
    <span className={
      s === "APPROVED" ? "text-green-600" :
      s === "REJECTED" ? "text-red-600" : "text-amber-600"
    }>{s}</span>
  );

  return (
    <div className="container py-[42px]">
      <h1 className="text-2xl font-bold mb-4">我的申请</h1>

      <h2 className="text-lg font-bold mt-6 mb-2">件号申请</h2>
      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left p-2">件号</th>
            <th className="text-left p-2">名称</th>
            <th className="text-left p-2">品牌</th>
            <th className="text-left p-2">状态</th>
            <th className="text-left p-2">时间</th>
            <th className="text-left p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {pnRequests.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2 font-mono font-bold">{r.partNumber}</td>
              <td className="p-2">{r.partName}</td>
              <td className="p-2">{r.brandName}</td>
              <td className="p-2">{statusTag(r.status)}</td>
              <td className="p-2 text-xs text-muted">{r.createdAt.toLocaleDateString()}</td>
              <td className="p-2">
                {r.status === "APPROVED" ? (
                  <Link href={`/supplier/products/new?partNumberId=${r.id}`} className="bg-amber-500 text-white px-2 py-1 rounded text-xs">发布产品</Link>
                ) : (
                  r.reviewReason && <span className="text-xs text-red-500">{r.reviewReason}</span>
                )}
              </td>
            </tr>
          ))}
          {pnRequests.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted">暂无件号申请</td></tr>}
        </tbody>
      </table>

      <h2 className="text-lg font-bold mt-8 mb-2">设备申请</h2>
      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left p-2">品牌</th>
            <th className="text-left p-2">型号</th>
            <th className="text-left p-2">名称</th>
            <th className="text-left p-2">状态</th>
            <th className="text-left p-2">时间</th>
            <th className="text-left p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {eqRequests.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.brandName}</td>
              <td className="p-2 font-mono font-bold">{r.model}</td>
              <td className="p-2">{r.name}</td>
              <td className="p-2">{statusTag(r.status)}</td>
              <td className="p-2 text-xs text-muted">{r.createdAt.toLocaleDateString()}</td>
              <td className="p-2">{r.reviewReason && <span className="text-xs text-red-500">{r.reviewReason}</span>}</td>
            </tr>
          ))}
          {eqRequests.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted">暂无设备申请</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
