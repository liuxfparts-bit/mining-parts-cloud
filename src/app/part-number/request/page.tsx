import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { submitPartNumberRequest } from "./actions";

export const dynamic = "force-dynamic";

export default async function PartNumberRequestPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/part-number/request");

  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const error = searchParams.error;

  return (
    <div className="container py-[42px] max-w-[720px]">
      <h1 className="text-3xl font-bold mb-2">申请新增件号</h1>
      <p className="text-muted mb-6">提交件号资料，平台管理员审核通过后将正式收录。</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">{error}</div>}

      <form action={async (fd) => { "use server"; await submitPartNumberRequest(fd); }} className="bg-white border rounded p-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">件号 *</label>
          <input name="partNumber" required placeholder="例如 XP210162" className="w-full border rounded px-3 py-2 font-mono" />
        </div>
        <div>
          <label className="block text-sm mb-1">配件名称（中文）*</label>
          <input name="partName" required placeholder="例如 锚杆机压块" className="w-full border rounded px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">品牌 *</label>
            <input name="brandName" required placeholder="例如 Sandvik" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">设备型号</label>
            <input name="equipmentModel" placeholder="例如 MB670-1" className="w-full border rounded px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">配件分类</label>
          <select name="categoryId" className="w-full border rounded px-3 py-2">
            <option value="">请选择分类</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">应用说明</label>
          <textarea name="description" rows={4} className="w-full border rounded px-3 py-2" />
        </div>
        <button className="bg-amber-500 text-white px-6 py-2 rounded font-bold">提交申请</button>
        <Link href="/part-number" className="ml-3 text-sm text-muted underline">返回件号库</Link>
      </form>
    </div>
  );
}
