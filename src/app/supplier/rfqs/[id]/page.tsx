export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { createQuote } from "../../actions";

export default async function QuotePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user?.supplierId) redirect("/supplier");

  const rfq = await prisma.rFQ.findUnique({
    where: { id: parseInt(params.id) },
    include: { partNumber: true },
  });
  if (!rfq) notFound();

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">报价：{rfq.title}</h1>
      <p className="text-gray-500 text-sm mb-4">件号 {rfq.partNumber?.number} · 数量 {rfq.quantity} {rfq.unit}</p>
      <form action={createQuote} className="bg-white rounded-lg border p-6 space-y-4">
        <input type="hidden" name="rfqId" value={rfq.id} />
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm mb-1">单价</label><input name="unitPrice" type="number" step="0.01" required className="border rounded px-3 py-2 text-sm w-full" /></div>
          <div><label className="block text-sm mb-1">币种</label>
            <select name="currency" className="border rounded px-3 py-2 text-sm w-full">
              <option>USD</option><option>CNY</option><option>EUR</option>
            </select>
          </div>
          <div><label className="block text-sm mb-1">交期（天）</label><input name="leadTime" className="border rounded px-3 py-2 text-sm w-full" /></div>
          <div><label className="block text-sm mb-1">质保</label><input name="warranty" className="border rounded px-3 py-2 text-sm w-full" placeholder="如 12 个月" /></div>
        </div>
        <div><label className="block text-sm mb-1">备注</label><textarea name="remarks" rows={3} className="border rounded px-3 py-2 text-sm w-full" /></div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">提交报价</button>
      </form>
    </div>
  );
}
