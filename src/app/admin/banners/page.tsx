export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function save(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const data = {
    title: (formData.get("title") as string).trim(),
    imageUrl: (formData.get("imageUrl") as string).trim(),
    targetType: formData.get("targetType") as string,
    targetId: formData.get("targetId") ? parseInt(formData.get("targetId") as string) : null,
    targetUrl: (formData.get("targetUrl") as string) || null,
    sortOrder: parseInt((formData.get("sortOrder") as string) || "0"),
    status: (formData.get("status") as string) || "ACTIVE",
  };
  if (id) await prisma.banner.update({ where: { id: parseInt(id) }, data });
  else await prisma.banner.create({ data });
  revalidatePath("/admin/banners");
}

async function del(formData: FormData) {
  "use server";
  await prisma.banner.delete({ where: { id: parseInt(formData.get("id") as string) } });
  revalidatePath("/admin/banners");
}

export default async function AdminBanners() {
  const [banners, products, companies] = await Promise.all([
    prisma.banner.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "desc" }] }),
    prisma.product.findMany({ where: { status: "PUBLISHED" }, include: { partNumber: true }, take: 100, orderBy: { id: "desc" } }),
    prisma.supplier.findMany({ orderBy: { id: "desc" } }),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">推荐位 / Banner 管理</h1>
      <form action={save} className="bg-white border rounded p-4 mb-6 space-y-3">
        <h2 className="font-bold">新增 / 编辑</h2>
        <input name="title" placeholder="标题" required className="border rounded px-3 py-2 text-sm w-full" />
        <input name="imageUrl" placeholder="图片 URL（先 /api/upload 上传）" required className="border rounded px-3 py-2 text-sm w-full" />
        <div className="grid grid-cols-2 gap-3">
          <select name="targetType" className="border rounded px-3 py-2 text-sm">
            <option value="product">产品</option>
            <option value="company">企业</option>
            <option value="url">外部链接</option>
          </select>
          <input name="targetUrl" placeholder="外部链接（targetType=url 时填）" className="border rounded px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select name="targetId" className="border rounded px-3 py-2 text-sm">
            <option value="">- 关联产品/企业 -</option>
            {products.map((p) => <option key={p.id} value={p.id}>产品：{p.name} ({p.partNumber?.number})</option>)}
            {companies.map((c) => <option key={c.id} value={c.id}>企业：{c.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input name="sortOrder" type="number" defaultValue={0} placeholder="排序" className="border rounded px-3 py-2 text-sm w-24" />
            <select name="status" className="border rounded px-3 py-2 text-sm">
              <option value="ACTIVE">启用</option>
              <option value="INACTIVE">停用</option>
            </select>
          </div>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded">保存</button>
      </form>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50"><tr><th className="p-2">ID</th><th className="p-2">图</th><th className="p-2">标题</th><th className="p-2">类型</th><th className="p-2">目标</th><th className="p-2">排序</th><th className="p-2">状态</th><th></th></tr></thead>
        <tbody>
          {banners.map((b) => (
            <tr key={b.id} className="border-b">
              <td className="p-2">{b.id}</td>
              <td className="p-2"><img src={b.imageUrl} className="h-10 w-20 object-cover" /></td>
              <td className="p-2">{b.title}</td>
              <td className="p-2">{b.targetType}</td>
              <td className="p-2">{b.targetId || b.targetUrl}</td>
              <td className="p-2">{b.sortOrder}</td>
              <td className="p-2">{b.status}</td>
              <td className="p-2">
                <form action={del}><input type="hidden" name="id" value={b.id} /><button className="text-red-600 text-xs">删除</button></form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
