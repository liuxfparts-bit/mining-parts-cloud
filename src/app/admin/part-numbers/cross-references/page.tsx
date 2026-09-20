export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

// Relation Type 显示配置（badge 颜色 + 提示文案）
const RELATION_TYPE_META: Record<string, { label: string; badgeClass: string; tooltip: string }> = {
  SAME_PART: {
    label: "SAME_PART",
    badgeClass: "bg-purple-100 text-purple-700",
    tooltip: "完全相同件（同一物理件，不同命名/编号体系）",
  },
  CROSS_REFERENCE: {
    label: "CROSS_REFERENCE",
    badgeClass: "bg-blue-100 text-blue-700",
    tooltip: "交叉引用（可互换/替代，非完全相同）",
  },
  POSSIBLE_MATCH: {
    label: "POSSIBLE_MATCH",
    badgeClass: "bg-amber-100 text-amber-700",
    tooltip: "候选匹配：技术等价性尚未确认，不代表可互换/替代",
  },
  SUPERSEDES: {
    label: "SUPERSEDES",
    badgeClass: "bg-gray-100 text-gray-700",
    tooltip: "有向关系：source 替代 target（新件替代旧件）",
  },
};

const VERIFICATION_STATUS_META: Record<string, { label: string; badgeClass: string }> = {
  CANDIDATE: { label: "待核实", badgeClass: "bg-amber-100 text-amber-700" },
  VERIFIED: { label: "已验证", badgeClass: "bg-green-100 text-green-700" },
  REJECTED: { label: "已驳回", badgeClass: "bg-red-100 text-red-700" },
};

const CONFIDENCE_META: Record<string, string> = {
  HIGH: "bg-green-50 text-green-700",
  MEDIUM: "bg-gray-50 text-gray-600",
  LOW: "bg-red-50 text-red-600",
};

export default async function AdminCrossReferencesPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    status?: string;
    relationType?: string;
    page?: string;
    pageSize?: string;
  };
}) {
  const q = (searchParams.q || "").trim();
  const statusFilter = ["ALL", "CANDIDATE", "VERIFIED", "REJECTED"].includes(searchParams.status || "ALL")
    ? searchParams.status || "ALL"
    : "ALL";
  const relationFilter = ["ALL", "SAME_PART", "CROSS_REFERENCE", "POSSIBLE_MATCH", "SUPERSEDES"].includes(
    searchParams.relationType || "ALL"
  )
    ? searchParams.relationType || "ALL"
    : "ALL";
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [20, 50, 100].includes(parseInt(searchParams.pageSize || "20"))
    ? parseInt(searchParams.pageSize || "20")
    : 20;

  // 构建 where：status + relationType + 件号搜索（同时匹配 source/target）
  const where: any = {};
  if (statusFilter !== "ALL") where.verificationStatus = statusFilter;
  if (relationFilter !== "ALL") where.relationType = relationFilter;
  if (q) {
    where.OR = [
      { sourcePartNumber: { number: { contains: q, mode: "insensitive" as const } } },
      { targetPartNumber: { number: { contains: q, mode: "insensitive" as const } } },
    ];
  }

  const include = {
    sourcePartNumber: {
      select: {
        id: true,
        number: true,
        name: true,
        verificationStatus: true,
        publishStatus: true,
        confidence: true,
        equipmentRelations: { select: { equipmentModel: { select: { id: true, model: true, name: true } } } },
      },
    },
    targetPartNumber: {
      select: {
        id: true,
        number: true,
        name: true,
        verificationStatus: true,
        publishStatus: true,
        confidence: true,
        equipmentRelations: { select: { equipmentModel: { select: { id: true, model: true, name: true } } } },
      },
    },
    verifiedBy: { select: { id: true, name: true, email: true } },
  };

  const [items, total, stats] = await Promise.all([
    prisma.partNumberCrossReference.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.partNumberCrossReference.count({ where }),
    prisma.partNumberCrossReference.groupBy({
      by: ["verificationStatus"],
      _count: { verificationStatus: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const totalAll = stats.reduce((s, r) => s + r._count.verificationStatus, 0);
  const candidateCount = stats.find((r) => r.verificationStatus === "CANDIDATE")?._count.verificationStatus || 0;
  const verifiedCount = stats.find((r) => r.verificationStatus === "VERIFIED")?._count.verificationStatus || 0;
  const rejectedCount = stats.find((r) => r.verificationStatus === "REJECTED")?._count.verificationStatus || 0;

  // 构建保留筛选参数的分页链接
  const queryBase = new URLSearchParams();
  if (q) queryBase.set("q", q);
  if (statusFilter !== "ALL") queryBase.set("status", statusFilter);
  if (relationFilter !== "ALL") queryBase.set("relationType", relationFilter);
  queryBase.set("pageSize", String(pageSize));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">件号交叉引用（Cross Reference）</h1>
        <span className="text-xs text-gray-500">只读审核台 · 本阶段无写操作</span>
      </div>

      {/* 顶部统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-2xl font-bold">{totalAll}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">待核实 CANDIDATE</div>
          <div className="text-2xl font-bold text-amber-600">{candidateCount}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">已验证 VERIFIED</div>
          <div className="text-2xl font-bold text-green-600">{verifiedCount}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">已驳回 REJECTED</div>
          <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
        </div>
      </div>

      {/* 筛选栏 */}
      <form method="GET" className="bg-white rounded-lg border p-3 mb-4 flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">件号搜索（匹配当前件号/关联件号）</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="如 114-8516LFL / G5-8516"
            className="border rounded px-3 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">验证状态</label>
          <select name="status" defaultValue={statusFilter} className="border rounded px-3 py-2 text-sm">
            <option value="ALL">全部</option>
            <option value="CANDIDATE">待核实</option>
            <option value="VERIFIED">已验证</option>
            <option value="REJECTED">已驳回</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">关系类型</label>
          <select name="relationType" defaultValue={relationFilter} className="border rounded px-3 py-2 text-sm">
            <option value="ALL">全部</option>
            <option value="SAME_PART">SAME_PART</option>
            <option value="CROSS_REFERENCE">CROSS_REFERENCE</option>
            <option value="POSSIBLE_MATCH">POSSIBLE_MATCH</option>
            <option value="SUPERSEDES">SUPERSEDES</option>
          </select>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">搜索</button>
        <Link href="/admin/part-numbers/cross-references" className="border px-4 py-2 rounded text-sm">
          重置
        </Link>
      </form>

      {/* 列表 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">当前件号</th>
              <th className="text-left p-3">关联件号</th>
              <th className="text-left p-3">关系类型</th>
              <th className="text-left p-3">验证状态</th>
              <th className="text-left p-3">置信度</th>
              <th className="text-left p-3">证据</th>
              <th className="text-left p-3">创建时间</th>
              <th className="text-left p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  暂无匹配的 Cross Reference
                </td>
              </tr>
            ) : (
              items.map((cr) => {
                const rtMeta = RELATION_TYPE_META[cr.relationType] || {
                  label: cr.relationType,
                  badgeClass: "bg-gray-100 text-gray-700",
                  tooltip: "",
                };
                const vsMeta = VERIFICATION_STATUS_META[cr.verificationStatus] || {
                  label: cr.verificationStatus,
                  badgeClass: "bg-gray-100 text-gray-700",
                };
                return (
                  <tr key={cr.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-mono font-medium">{cr.sourcePartNumber.number}</div>
                      <div className="text-xs text-gray-500">{cr.sourcePartNumber.name}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono font-medium">{cr.targetPartNumber.number}</div>
                      <div className="text-xs text-gray-500">{cr.targetPartNumber.name}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-xs px-2 py-1 rounded ${rtMeta.badgeClass}`}
                        title={rtMeta.tooltip}
                      >
                        {rtMeta.label}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded ${vsMeta.badgeClass}`}>{vsMeta.label}</span>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded ${CONFIDENCE_META[cr.confidence] || "bg-gray-50"}`}>
                        {cr.confidence}
                      </span>
                    </td>
                    <td className="p-3 max-w-[200px]">
                      <div className="text-xs text-gray-600 truncate" title={cr.evidenceSummary || ""}>
                        {cr.evidenceSummary || "-"}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-gray-500">
                      {new Date(cr.createdAt).toLocaleString("zh-CN", { hour12: false })}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/part-numbers/cross-references/${cr.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        查看
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div className="flex justify-between items-center mt-3 text-sm">
        <span>
          第 {page} / {totalPages} 页，共 {total} 条
        </span>
        <div className="flex gap-2">
          <Link
            href={`?${queryBase.toString()}&page=${Math.max(1, page - 1)}`}
            className="border px-3 py-1 rounded"
          >
            上一页
          </Link>
          <Link
            href={`?${queryBase.toString()}&page=${Math.min(totalPages, page + 1)}`}
            className="border px-3 py-1 rounded"
          >
            下一页
          </Link>
        </div>
      </div>
    </div>
  );
}
