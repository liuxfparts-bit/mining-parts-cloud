export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createProduct } from "../../actions";

export default async function NewProduct() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const partNumbers = await prisma.partNumber.findMany({ orderBy: { number: "asc" }, take: 500 });

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">新增产品</h1>
      <form action={createProduct} className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">关联件号</label>
          <select name="partNumberId" required className="border rounded px-3 py-2 text-sm w-full">
            {partNumbers.map((p) => (
              <option key={p.id} value={p.id}>{p.number} - {p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">产品名称</label>
          <input name="name" required className="border rounded px-3 py-2 text-sm w-full" placeholder="如：XP210162 导向件" />
        </div>
        <div>
          <label className="block text-sm mb-1">报价（USD）</label>
          <input name="price" type="number" step="0.01" className="border rounded px-3 py-2 text-sm w-full" />
        </div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">提交（待管理员审核）</button>
      </form>
    </div>
  );
}
