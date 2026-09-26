export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { reviewPartNumberStatus, updatePartNumber } from "../../actions";
import { GOLDEN_PRIORITY_BY_NUMBER } from "@/lib/part-number-review-golden";

export default async function PartNumberReviewPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const p = await prisma.partNumber.findUnique({
    where: { id },
    include: {
      brand: true,
      equipmentRelations: { include: { equipmentModel: { include: { brand: true } } }, orderBy: { id: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 30 },
      crossReferencesAsSource: { include: { targetPartNumber: true }, orderBy: { updatedAt: "desc" } },
      crossReferencesAsTarget: { include: { sourcePartNumber: true }, orderBy: { updatedAt: "desc" } },
    },
  });
  if (!p) notFound();

  const f = "border rounded px-3 py-2 text-sm w-full";
  const priority = GOLDEN_PRIORITY_BY_NUMBER.get(p.number) || "-";

  return (
    <div className="p-6 max-w-6xl space-y-5">
      <div>
        <Link href="/admin/part-numbers?golden=1" className="text-sm text-blue-600 hover:underline">← 返回 Part Number 审核台</Link>
        <div className="flex items-start justify-between gap-4 flex-wrap mt-3">
          <div>
            <h1 className="text-2xl font-bold font-mono">{p.number}</h1>
            <div className="text-gray-600">{p.name}{p.nameEn ? ` / ${p.nameEn}` : ""}</div>
          </div>
          <div className="text-sm flex gap-2 flex-wrap">
            <span className="border rounded px-2 py-1">Priority {priority}</span>
            <span className="border rounded px-2 py-1">Verification {p.verificationStatus}</span>
            <span className="border rounded px-2 py-1">Publish {p.publishStatus}</span>
            <span className="border rounded px-2 py-1">Confidence {p.confidence}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 bg-white border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold text-lg">数据与证据</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Normalized PN</span><div className="font-mono">{p.normalizedPartNumber || "-"}</div></div>
            <div><span className="text-gray-500">Brand</span><div>{p.brand?.name || "-"}</div></div>
            <div><span className="text-gray-500">Category</span><div>{p.category || "-"}</div></div>
            <div><span className="text-gray-500">Model Evidence</span><div>{p.modelEvidence}</div></div>
            <div><span className="text-gray-500">Original EN</span><div>{p.originalDescriptionEn || "-"}</div></div>
            <div><span className="text-gray-500">Original CN</span><div>{p.originalDescriptionCn || "-"}</div></div>
          </div>
          <div className="text-sm">
            <div className="text-gray-500 mb-1">Evidence Summary</div>
            <div className="whitespace-pre-wrap border rounded bg-gray-50 p-3">{p.evidenceSummary || "暂无证据摘要"}</div>
          </div>
          <div className="text-sm">
            <div className="text-gray-500 mb-1">Source Files</div>
            <div className="whitespace-pre-wrap break-all border rounded bg-gray-50 p-3">{p.sourceFiles || "-"}</div>
          </div>
          <div className="text-xs text-gray-500">最近验证：{p.lastVerifiedAt ? p.lastVerifiedAt.toLocaleString("zh-CN") : "-"} / verifiedById: {p.verifiedById ?? "-"}</div>
        </section>

        <section className="bg-white border rounded-lg p-5">
          <h2 className="font-semibold text-lg mb-3">审核操作</h2>
          <form action={async (fd) => { "use server"; await reviewPartNumberStatus(p.id, fd); }} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">审核结论</label>
              <select name="verificationStatus" defaultValue={p.verificationStatus} className={f}>
                <option value="VERIFIED">确认 VERIFIED</option>
                <option value="UNVERIFIED">待核实 UNVERIFIED</option>
                <option value="CONFLICT">冲突 CONFLICT</option>
                <option value="REJECTED">驳回 REJECTED</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">发布状态</label>
              <select name="publishStatus" defaultValue={p.publishStatus === "HIDDEN" ? "HOLD" : p.publishStatus} className={f}>
                <option value="HOLD">HOLD</option>
                <option value="READY">READY（仅 VERIFIED 可用）</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">审核备注 / 证据说明（必填）</label>
              <textarea name="reason" required minLength={2} maxLength={2000} rows={6} className={f} placeholder="说明为什么确认、待核实、冲突或驳回；必要时写明证据来源。" />
            </div>
            <button className="w-full bg-blue-600 text-white px-4 py-2 rounded">保存审核结果</button>
            <p className="text-xs text-gray-500">规则：非 VERIFIED 状态不能 READY；每次操作都会写 PartNumberAuditLog。</p>
          </form>
        </section>
      </div>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-lg mb-3">Equipment Relations</h2>
        {p.equipmentRelations.length === 0 ? <p className="text-sm text-gray-500">暂无正式设备关系。</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="text-left p-2">Brand / Model</th><th className="text-left p-2">Evidence</th><th className="text-left p-2">Verification</th><th className="text-left p-2">摘要 / 来源</th></tr></thead>
              <tbody>{p.equipmentRelations.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.equipmentModel.brand?.name || "-"} / {r.equipmentModel.model}</td>
                  <td className="p-2">{r.evidenceStatus}</td>
                  <td className="p-2">{r.verificationStatus}</td>
                  <td className="p-2"><div className="whitespace-pre-wrap">{r.evidenceSummary || "-"}</div><div className="text-xs text-gray-500 break-all">{r.sourceReference || ""}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-lg mb-3">Cross Reference</h2>
        {p.crossReferencesAsSource.length + p.crossReferencesAsTarget.length === 0 ? <p className="text-sm text-gray-500">暂无 Cross Reference。</p> : (
          <div className="space-y-2 text-sm">
            {p.crossReferencesAsSource.map((r) => <div key={`s-${r.id}`} className="border rounded p-3"><span className="font-mono">{p.number}</span> → <span className="font-mono">{r.targetPartNumber.number}</span> · {r.relationType} · {r.verificationStatus} · {r.confidence}<div className="text-gray-500 mt-1">{r.evidenceSummary || "-"}</div></div>)}
            {p.crossReferencesAsTarget.map((r) => <div key={`t-${r.id}`} className="border rounded p-3"><span className="font-mono">{r.sourcePartNumber.number}</span> → <span className="font-mono">{p.number}</span> · {r.relationType} · {r.verificationStatus} · {r.confidence}<div className="text-gray-500 mt-1">{r.evidenceSummary || "-"}</div></div>)}
          </div>
        )}
      </section>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-lg mb-3">Audit History</h2>
        {p.auditLogs.length === 0 ? <p className="text-sm text-gray-500">暂无审核日志。</p> : (
          <div className="space-y-2">{p.auditLogs.map((log) => (
            <div key={log.id} className="border rounded p-3 text-sm">
              <div className="font-medium">{log.action} · {log.createdAt.toLocaleString("zh-CN")}</div>
              <div className="text-gray-600">{log.oldVerification || "-"} → {log.newVerification || "-"} / {log.oldPublishStatus || "-"} → {log.newPublishStatus || "-"}</div>
              <div className="whitespace-pre-wrap mt-1">{log.reason || "-"}</div>
              <div className="text-xs text-gray-500">changedById: {log.changedById ?? "-"}</div>
            </div>
          ))}</div>
        )}
      </section>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-lg mb-3">基础字段编辑</h2>
        <form action={async (fd) => { "use server"; await updatePartNumber(p.id, fd); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm mb-1">件号</label><input defaultValue={p.number} readOnly className={f + " bg-gray-50"} /></div>
          <div><label className="block text-sm mb-1">名称</label><input name="name" defaultValue={p.name} required className={f} /></div>
          <div><label className="block text-sm mb-1">规格</label><input name="specification" defaultValue={p.specification || ""} className={f} /></div>
          <div><label className="block text-sm mb-1">应用</label><input name="application" defaultValue={p.application || ""} className={f} /></div>
          <div className="md:col-span-2"><button className="bg-gray-800 text-white px-6 py-2 rounded">保存基础字段</button></div>
        </form>
      </section>
    </div>
  );
}
