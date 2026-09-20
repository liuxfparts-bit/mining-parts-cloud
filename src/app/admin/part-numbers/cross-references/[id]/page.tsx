export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import CrossReferenceReviewActions from "@/components/admin/CrossReferenceReviewActions";

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

const PN_STATUS_META: Record<string, string> = {
  READY: "bg-green-100 text-green-700",
  HOLD: "bg-amber-100 text-amber-700",
  HIDDEN: "bg-gray-100 text-gray-600",
};

const PN_VERIFICATION_META: Record<string, string> = {
  VERIFIED: "bg-green-100 text-green-700",
  UNVERIFIED: "bg-gray-100 text-gray-600",
  CANDIDATE: "bg-amber-100 text-amber-700",
  CONFLICT: "bg-red-100 text-red-700",
  REJECTED: "bg-red-100 text-red-700",
};

function PartNumberCard({ label, pn }: { label: string; pn: any }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className="font-mono text-lg font-bold">{pn.number}</div>
      <div className="text-sm text-gray-600 mb-3">{pn.name || "-"}</div>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`text-xs px-2 py-1 rounded ${PN_VERIFICATION_META[pn.verificationStatus] || "bg-gray-100"}`}>
          {pn.verificationStatus}
        </span>
        <span className={`text-xs px-2 py-1 rounded ${PN_STATUS_META[pn.publishStatus] || "bg-gray-100"}`}>
          {pn.publishStatus}
        </span>
        <span className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-600">confidence: {pn.confidence}</span>
      </div>
      <div className="text-xs text-gray-500">
        <span className="font-medium">适用设备（PartNumberEquipment）：</span>
        {pn.equipmentRelations.length === 0 ? (
          <span className="text-gray-400"> 无</span>
        ) : (
          pn.equipmentRelations.map((r: any) => (
            <span key={r.equipmentModel.id} className="inline-block ml-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
              {r.equipmentModel.model}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default async function CrossReferenceDetail({ params }: { params: { id: string } }) {
  const cr = await prisma.partNumberCrossReference.findUnique({
    where: { id: parseInt(params.id) },
    include: {
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
    },
  });
  if (!cr) notFound();

  const rtMeta = RELATION_TYPE_META[cr.relationType] || {
    label: cr.relationType,
    badgeClass: "bg-gray-100 text-gray-700",
    tooltip: "",
  };
  const vsMeta = VERIFICATION_STATUS_META[cr.verificationStatus] || {
    label: cr.verificationStatus,
    badgeClass: "bg-gray-100 text-gray-700",
  };

  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleString("zh-CN", { hour12: false }) : "-");

  return (
    <div className="p-6 max-w-5xl">
      <Link href="/admin/part-numbers/cross-references" className="text-sm text-blue-600 hover:underline">
        ← 返回 Cross Reference 列表
      </Link>

      <div className="flex justify-between items-center mt-4 mb-6">
        <h1 className="text-2xl font-bold">Cross Reference 详情 #{cr.id}</h1>
        <span className="text-xs text-gray-500">Admin 审核 · VERIFY / REJECT</span>
      </div>

      {/* 两个 Part Number 卡片 */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <PartNumberCard label="当前件号（Part Number A）" pn={cr.sourcePartNumber} />
        <div className="flex items-center justify-center text-2xl text-gray-400">↕</div>
        <PartNumberCard label="关联件号（Part Number B）" pn={cr.targetPartNumber} />
      </div>

      {/* 关系详情 */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-bold mb-2">关系信息</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">关系类型 Relation Type</div>
            <span className={`text-xs px-2 py-1 rounded ${rtMeta.badgeClass}`} title={rtMeta.tooltip}>
              {rtMeta.label}
            </span>
            {rtMeta.tooltip && <div className="text-xs text-gray-400 mt-1">{rtMeta.tooltip}</div>}
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">验证状态 Verification Status</div>
            <span className={`text-xs px-2 py-1 rounded ${vsMeta.badgeClass}`}>{vsMeta.label}</span>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">置信度 Confidence</div>
            <span className="text-sm font-medium">{cr.confidence}</span>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">验证人 Verified By</div>
            <span className="text-sm">{cr.verifiedBy ? `${cr.verifiedBy.name} (${cr.verifiedBy.email})` : "-"}</span>
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">证据摘要 Evidence Summary</div>
          <div className="text-sm bg-gray-50 rounded p-3 whitespace-pre-wrap">{cr.evidenceSummary || "-"}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">来源引用 Source Reference</div>
          <div className="text-sm bg-gray-50 rounded p-3 whitespace-pre-wrap">{cr.sourceReference || "-"}</div>
        </div>

        {cr.verificationStatus === "REJECTED" && (
          <div>
            <div className="text-xs text-gray-500 mb-1">驳回原因 Rejection Reason</div>
            <div className="text-sm bg-red-50 rounded p-3 whitespace-pre-wrap">{cr.rejectionReason || "-"}</div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 pt-2 border-t">
          <div>
            <div className="text-xs text-gray-500">创建时间</div>
            <div className="text-sm">{fmt(cr.createdAt)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">最后更新</div>
            <div className="text-sm">{fmt(cr.updatedAt)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">验证时间 / 驳回时间</div>
            <div className="text-sm">
              {cr.verifiedAt ? `验证: ${fmt(cr.verifiedAt)}` : "-"}
              {cr.rejectedAt ? ` / 驳回: ${fmt(cr.rejectedAt)}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* 审核操作区域（CANDIDATE 可操作；VERIFIED/REJECTED 显示终态） */}
      <div className="mt-6">
        <CrossReferenceReviewActions
          crId={cr.id}
          relationType={cr.relationType}
          verificationStatus={cr.verificationStatus}
        />
      </div>

      <div className="mt-6 text-xs text-gray-400">
        注意：source/target 为数据库 canonical ordering（对称关系时 sourceId &lt; targetId），不代表所有业务关系的方向。
        Cross Reference 状态变化不会自动改变关联 Part Number 的 verificationStatus / publishStatus / brand / equipmentRelations。
      </div>
    </div>
  );
}
