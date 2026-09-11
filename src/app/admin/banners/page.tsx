import ImageUploader from "./ImageUploader";
import AsyncTargetSelect from "./AsyncTargetSelect";
import BannerPreviewModal from "./BannerPreviewModal";
import ConfirmButton from "./ConfirmButton";

export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Pagination from "@/components/Pagination";

async function save(formData: FormData) {
  "use server";
  try {
    const id = formData.get("id") as string;
    const start = (formData.get("startAt") as string) || null;
    const end = (formData.get("endAt") as string) || null;
    if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
      redirect("/admin/banners?error=" + encodeURIComponent("结束时间不能早于开始时间"));
    }
    const data: any = {
      title: ((formData.get("title") as string) || "").trim(),
      imageUrl: ((formData.get("imageUrl") as string) || "").trim(),
      position: (formData.get("position") as string) || "HOME_TOP",
      targetType: (formData.get("targetType") as string) || "URL",
      targetId: formData.get("targetId") ? parseInt(formData.get("targetId") as string) : null,
      targetUrl: (formData.get("targetUrl") as string) || null,
      sortOrder: parseInt((formData.get("sortOrder") as string) || "0"),
      status: (formData.get("status") as string) || "ACTIVE",
      startAt: start ? new Date(start) : null,
      endAt: end ? new Date(end) : null,
    };
    if (!data.title || !data.imageUrl) {
      redirect("/admin/banners?error=" + encodeURIComponent("标题和图片必填"));
    }
    if (id) await prisma.banner.update({ where: { id: parseInt(id) }, data });
    else await prisma.banner.create({ data });
    revalidatePath("/admin/banners");
    revalidatePath("/");
    redirect("/admin/banners?ok=1");
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    redirect("/admin/banners?error=" + encodeURIComponent(e?.message || "保存失败"));
  }
}

async function del(formData: FormData) {
  "use server";
  await prisma.banner.delete({ where: { id: parseInt(formData.get("id") as string) } });
  revalidatePath("/admin/banners");
  revalidatePath("/");
}

async function toggle(formData: FormData) {
  "use server";
  const id = parseInt(formData.get("id") as string);
  const b = await prisma.banner.findUnique({ where: { id } });
  if (b) await prisma.banner.update({ where: { id }, data: { status: b.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } });
  revalidatePath("/admin/banners");
  revalidatePath("/");
}

const POS: Record<string, string> = { HOME_TOP: "首页顶部", HOME_RECOMMEND: "首页推荐", HOME_MIDDLE: "首页中部", HOME_BOTTOM: "首页底部" };
const TYP: Record<string, string> = { PRODUCT: "产品", COMPANY: "企业", URL: "自定义链接" };
const STA: Record<string, { t: string; c: string }> = {
  DRAFT: { t: "草稿", c: "bg-gray-100" },
  ACTIVE: { t: "已启用", c: "bg-green-100 text-green-700" },
  INACTIVE: { t: "已停用", c: "bg-gray-100 text-gray-600" },
  EXPIRED: { t: "已过期", c: "bg-red-100 text-red-700" },
};

export default async function AdminBanners({ searchParams }: { searchParams: any }) {
  const q = (searchParams.q || "").trim();
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [20, 50, 100].includes(parseInt(searchParams.pageSize || "20")) ? parseInt(searchParams.pageSize || "20") : 20;
  const where: any = {};
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (searchParams.position) where.position = searchParams.position;
  if (searchParams.type) where.targetType = searchParams.type;
  if (searchParams.status) where.status = searchParams.status;

  const [list, total, editing] = await Promise.all([
    prisma.banner.findMany({ where, orderBy: [{ sortOrder: "asc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.banner.count({ where }),
    searchParams.edit ? prisma.banner.findUnique({ where: { id: parseInt(searchParams.edit) } }) : null,
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">广告位管理</h1>
      </div>

      {searchParams?.error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{searchParams.error as string}</div>}
      {searchParams?.ok && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">保存成功</div>}

      <form method="GET" className="bg-white border rounded p-3 mb-4 flex gap-2 flex-wrap">
        <input name="q" defaultValue={q} placeholder="广告标题" className="border rounded px-3 py-2 text-sm flex-1 min-w-[160px]" />
        <select name="position" className="border rounded px-3 py-2 text-sm">
          <option value="">全部位置</option>
          {Object.entries(POS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="type" className="border rounded px-3 py-2 text-sm">
          <option value="">全部类型</option>
          {Object.entries(TYP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="status" className="border rounded px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {Object.entries(STA).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
        </select>
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">搜索</button>
        <a href="/admin/banners" className="border px-4 py-2 rounded text-sm">重置</a>
      </form>

      <form action={save} className="bg-white border rounded p-4 mb-6 space-y-3">
        <h2 className="font-bold">{editing ? `编辑 #${editing.id}` : "+ 新增广告"}</h2>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <input name="title" placeholder="广告标题" required defaultValue={editing?.title || ""} className="border rounded px-3 py-2 text-sm w-full" />
        <div>
          <label className="block text-xs mb-1">广告图片（推荐 1440×480）</label>
          <div className="flex gap-2">
            <input name="imageUrl" id="imageUrlInput" placeholder="图片 URL" required defaultValue={editing?.imageUrl || ""} className="border rounded px-3 py-2 text-sm flex-1" />
            <ImageUploader />
          </div>
          {editing?.imageUrl && <img src={editing.imageUrl} className="mt-2 h-20 object-contain border rounded" />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select name="position" className="border rounded px-3 py-2 text-sm" defaultValue={editing?.position || "HOME_TOP"}>
            {Object.entries(POS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="targetType" className="border rounded px-3 py-2 text-sm" defaultValue={editing?.targetType || "URL"}>
            {Object.entries(TYP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <AsyncTargetSelect type={(editing?.targetType as any) || "URL"} targetId={editing?.targetId} />
          <input name="targetUrl" placeholder="自定义 URL" defaultValue={editing?.targetUrl || ""} className="border rounded px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs">开始时间</label>
            <input name="startAt" type="datetime-local" defaultValue={editing?.startAt ? new Date(editing.startAt).toISOString().slice(0, 16) : ""} className="border rounded px-2 py-1.5 text-sm w-full" />
          </div>
          <div>
            <label className="text-xs">结束时间</label>
            <input name="endAt" type="datetime-local" defaultValue={editing?.endAt ? new Date(editing.endAt).toISOString().slice(0, 16) : ""} className="border rounded px-2 py-1.5 text-sm w-full" />
          </div>
          <input name="sortOrder" type="number" defaultValue={editing?.sortOrder || 0} className="border rounded px-3 py-2 text-sm self-end" placeholder="排序" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <select name="status" className="border rounded px-3 py-2 text-sm" defaultValue={editing?.status || "ACTIVE"}>
            {Object.entries(STA).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
          </select>
          <button className="bg-blue-600 text-white px-4 py-2 rounded">{editing ? "保存修改" : "保存"}</button>
        </div>
      </form>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2">图</th><th className="p-2">标题</th><th className="p-2">位置</th><th className="p-2">类型</th><th className="p-2">状态</th><th className="p-2">排序</th>
            <th className="p-2">曝光</th><th className="p-2">点击</th><th className="p-2">CTR</th><th className="p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? <tr><td colSpan={10} className="p-6 text-center text-gray-500">暂无广告</td></tr> :
            list.map((b) => {
              const now = new Date();
              const expired = b.endAt && b.endAt < now;
              const st = expired ? { t: "已过期", c: "bg-red-100 text-red-700" } : (STA[b.status] || { t: b.status, c: "" });
              const ctr = b.impressions > 0 ? ((b.clicks / b.impressions) * 100).toFixed(2) + "%" : "0%";
              return (
                <tr key={b.id} className="border-b">
                  <td className="p-2"><img src={b.imageUrl} className="h-10 w-20 object-cover rounded" /></td>
                  <td className="p-2">{b.title}</td>
                  <td className="p-2">{POS[b.position] || b.position}</td>
                  <td className="p-2">{TYP[b.targetType] || b.targetType}</td>
                  <td className="p-2"><span className={`text-xs px-2 py-1 rounded ${st.c}`}>{st.t}</span></td>
                  <td className="p-2">{b.sortOrder}</td>
                  <td className="p-2">{b.impressions}</td>
                  <td className="p-2">{b.clicks}</td>
                  <td className="p-2">{ctr}</td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <a href={`/admin/banners?edit=${b.id}`} className="text-xs text-blue-600">编辑</a>
                      <BannerPreviewModal banner={b} />
                      <form action={toggle}><input type="hidden" name="id" value={b.id} /><button className="text-xs text-gray-600">{b.status === "ACTIVE" ? "停用" : "启用"}</button></form>
                      <ConfirmButton formAction={del} confirmText="确定删除该广告？" className="text-xs text-red-600" id={String(b.id)}>删除</ConfirmButton>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} baseQuery={new URLSearchParams(searchParams as any)} />
    </div>
  );
}
