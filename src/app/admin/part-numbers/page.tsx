export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { createPartNumber } from "../actions";
import {
  GOLDEN_PRIORITY_BY_NUMBER,
  GOLDEN_SANDVIK_NUMBERS,
  goldenNumbersByPriority,
} from "@/lib/part-number-review-golden";

const verificationOptions = ["CANDIDATE", "UNVERIFIED", "VERIFIED", "CONFLICT", "REJECTED"];
const publishOptions = ["READY", "HOLD", "HIDDEN"];

function paramsHref(current: Record<string, string>, changes: Record<string, string | number>) {
  const p = new URLSearchParams(current);
  Object.entries(changes).forEach(([k, v]) => p.set(k, String(v)));
  return `?${p.toString()}`;
}

export default async function AdminPartNumbersPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    page?: string;
    pageSize?: string;
    priority?: string;
    verification?: string;
    publish?: string;
    equipmentId?: string;
    golden?: string;
  };
}) {
  const q = (searchParams.q || "").trim();
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const parsedPageSize = parseInt(searchParams.pageSize || "20");
  const pageSize = [20, 50, 100].includes(parsedPageSize) ? parsedPageSize : 20;
  const priority = ["P1", "P2", "P3"].includes(searchParams.priority || "") ? searchParams.priority! : "";
  const verification = verificationOptions.includes(searchParams.verification || "") ? searchParams.verification! : "";
  const publish = publishOptions.includes(searchParams.publish || "") ? searchParams.publish! : "";
  const equipmentId = Number(searchParams.equipmentId || 0) || 0;
  const golden = searchParams.golden !== "0";

  const filters: any[] = [];
  if (golden) filters.push({ number: { in: goldenNumbersByPriority(priority) } });
  else if (priority) filters.push({ number: { in: goldenNumbersByPriority(priority) } });
  if (verification) filters.push({ verificationStatus: verification });
  if (publish) filters.push({ publishStatus: publish });
  if (equipmentId) filters.push({ equipmentRelations: { some: { equipmentModelId: equipmentId } } });
  if (q) {
    filters.push({
      OR: [
        { number: { contains: q, mode: "insensitive" as const } },
        { normalizedPartNumber: { contains: q, mode: "insensitive" as const } },
        { name: { contains: q, mode: "insensitive" as const } },
        { nameEn: { contains: q, mode: "insensitive" as const } },
        { brand: { name: { contains: q, mode: "insensitive" as const } } },
        { equipmentRelations: { some: { equipmentModel: { model: { contains: q, mode: "insensitive" as const } } } } },
      ],
    });
  }
  const where: any = filters.length ? { AND: filters } : {};

  const [items, total, brands, equipments, goldenRows, pendingReq] = await Promise.all([
    prisma.partNumber.findMany({
      where,
      include: {
        brand: true,
        equipmentRelations: { include: { equipmentModel: true } },
        _count: { select: { products: true } },
      },
      orderBy: [{ verificationStatus: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.partNumber.count({ where }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.equipment.findMany({ orderBy: [{ brandId: "asc" }, { model: "asc" }] }),
    prisma.partNumber.findMany({
      where: { number: { in: GOLDEN_SANDVIK_NUMBERS } },
      select: { number: true, verificationStatus: true, publishStatus: true },
    }),
    prisma.partNumberRequest.count({ where: { status: "PENDING" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const goldenVerified = goldenRows.filter((x) => x.verificationStatus === "VERIFIED").length;
  const goldenConflict = goldenRows.filter((x) => x.verificationStatus === "CONFLICT").length;
  const goldenReady = goldenRows.filter((x) => x.publishStatus === "READY").length;
  const current = {
    q,
    pageSize: String(pageSize),
    priority,
    verification,
    publish,
    equipmentId: equipmentId ? String(equipmentId) : "",
    golden: golden ? "1" : "0",
  };

  const badge = (value: string) => {
    const cls =
      value === "VERIFIED" || value === "READY"
        ? "bg-green-100 text-green-700"
        : value === "CONFLICT" || value === "REJECTED"
          ? "bg-red-100 text-red-700"
          : "bg-amber-100 text-amber-800";
    return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{value}</span>;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Part Number 审核台</h1>
          <p className="text-sm text-gray-500 mt-1">正式审核依据 verificationStatus + publishStatus；旧 verified 字段仅作兼容。</p>
        </div>
        <Link href="/admin/part-number-requests" className="text-sm text-blue-600">待审核申请 ({pendingReq})</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="border rounded-lg bg-white p-3"><div className="text-xs text-gray-500">黄金样本基准</div><div className="text-2xl font-bold">63</div></div>
        <div className="border rounded-lg bg-white p-3"><div className="text-xs text-gray-500">数据库已匹配</div><div className="text-2xl font-bold">{goldenRows.length}</div></div>
        <div className="border rounded-lg bg-white p-3"><div className="text-xs text-gray-500">VERIFIED</div><div className="text-2xl font-bold">{goldenVerified}</div></div>
        <div className="border rounded-lg bg-white p-3"><div className="text-xs text-gray-500">CONFLICT</div><div className="text-2xl font-bold">{goldenConflict}</div></div>
        <div className="border rounded-lg bg-white p-3"><div className="text-xs text-gray-500">READY</div><div className="text-2xl font-bold">{goldenReady}</div></div>
      </div>

      <form method="GET" className="bg-white rounded-lg border p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">搜索</label>
          <input name="q" defaultValue={q} placeholder="件号 / 名称 / 品牌 / 设备型号" className="border rounded px-3 py-2 text-sm w-full" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">审核优先级</label>
          <select name="priority" defaultValue={priority} className="border rounded px-3 py-2 text-sm w-full">
            <option value="">全部</option><option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Verification</label>
          <select name="verification" defaultValue={verification} className="border rounded px-3 py-2 text-sm w-full">
            <option value="">全部</option>{verificationOptions.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Publish</label>
          <select name="publish" defaultValue={publish} className="border rounded px-3 py-2 text-sm w-full">
            <option value="">全部</option>{publishOptions.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">设备型号</label>
          <select name="equipmentId" defaultValue={equipmentId || ""} className="border rounded px-3 py-2 text-sm w-full">
            <option value="">全部</option>{equipments.map((e) => <option key={e.id} value={e.id}>{e.model}</option>)}
          </select>
        </div>
        <input type="hidden" name="golden" value={golden ? "1" : "0"} />
        <div className="md:col-span-6 flex gap-2 flex-wrap">
          <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">筛选</button>
          <Link href="/admin/part-numbers?golden=1" className="border px-4 py-2 rounded text-sm">黄金样本 63</Link>
          <Link href="/admin/part-numbers?golden=0" className="border px-4 py-2 rounded text-sm">全部件号</Link>
        </div>
      </form>

      <form action={createPartNumber} className="bg-white rounded-lg border p-3 flex gap-2 items-end flex-wrap">
        <input name="number" placeholder="件号 (如 XP210162)" required className="border rounded px-3 py-2 text-sm" />
        <input name="name" placeholder="名称" required className="border rounded px-3 py-2 text-sm" />
        <select name="brandId" className="border rounded px-3 py-2 text-sm"><option value="">选品牌</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select name="equipmentId" className="border rounded px-3 py-2 text-sm"><option value="">选设备</option>{equipments.map((e) => <option key={e.id} value={e.id}>{e.model}</option>)}</select>
        <button className="bg-gray-800 text-white px-4 py-2 rounded text-sm">新增件号</button>
      </form>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">优先级</th><th className="text-left p-3">件号</th><th className="text-left p-3">名称</th>
              <th className="text-left p-3">品牌</th><th className="text-left p-3">设备关系</th><th className="text-left p-3">Verification</th>
              <th className="text-left p-3">Publish</th><th className="text-left p-3">Confidence</th><th className="text-left p-3">产品数</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={9} className="p-6 text-center text-gray-500">暂无匹配件号</td></tr>
            ) : items.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{GOLDEN_PRIORITY_BY_NUMBER.get(p.number) || "-"}</td>
                <td className="p-3 font-mono font-medium"><Link href={`/admin/part-numbers/${p.id}`} className="text-blue-600 hover:underline">{p.number}</Link></td>
                <td className="p-3"><div>{p.name}</div>{p.nameEn && <div className="text-xs text-gray-500">{p.nameEn}</div>}</td>
                <td className="p-3">{p.brand?.name || "-"}</td>
                <td className="p-3">{p.equipmentRelations.map((r) => `${r.equipmentModel.model} (${r.verificationStatus})`).join(" / ") || "-"}</td>
                <td className="p-3">{badge(p.verificationStatus)}</td>
                <td className="p-3">{badge(p.publishStatus)}</td>
                <td className="p-3">{p.confidence}</td>
                <td className="p-3">{p._count.products}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-sm">
        <span>第 {page} / {totalPages} 页，共 {total} 条</span>
        <div className="flex gap-2">
          <Link href={paramsHref(current, { page: Math.max(1, page - 1) })} className="border px-3 py-1 rounded">上一页</Link>
          <Link href={paramsHref(current, { page: Math.min(totalPages, page + 1) })} className="border px-3 py-1 rounded">下一页</Link>
        </div>
      </div>
    </div>
  );
}
