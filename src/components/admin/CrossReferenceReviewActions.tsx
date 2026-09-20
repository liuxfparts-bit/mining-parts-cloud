"use client";

import { useState } from "react";
import { verifyCrossReference, rejectCrossReference } from "@/app/admin/actions";

export default function CrossReferenceReviewActions({
  crId,
  relationType,
  verificationStatus,
}: {
  crId: number;
  relationType: string;
  verificationStatus: string;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 终态：只显示状态，不显示操作按钮
  if (verificationStatus === "VERIFIED") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="text-sm font-medium text-green-700">该 Cross Reference 已验证</div>
        <div className="text-xs text-green-600 mt-1">
          验证关联关系不会自动验证或公开两个 Part Number。第一版不支持撤销验证。
        </div>
      </div>
    );
  }

  if (verificationStatus === "REJECTED") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-sm font-medium text-red-700">该 Cross Reference 已驳回</div>
        <div className="text-xs text-red-600 mt-1">第一版不支持撤销驳回。</div>
      </div>
    );
  }

  // CANDIDATE 状态：显示审核操作
  const handleVerify = async () => {
    const confirmed = window.confirm(
      "确认验证这条 Cross Reference？\n\n注意：验证关联关系不会自动验证或公开两个 Part Number。\nG5-8516 仍将保持 UNVERIFIED / HOLD，不会自动公开。"
    );
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await verifyCrossReference(crId);
    } catch (e: any) {
      if (e?.digest?.startsWith("NEXT_REDIRECT")) {
        // redirect 是正常的，让 Next.js 处理
        throw e;
      }
      alert("验证失败：" + (e?.message || "未知错误"));
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 2 || trimmed.length > 2000) {
      alert("驳回原因必填，长度需在 2-2000 字符之间");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("rejectionReason", trimmed);
      await rejectCrossReference(crId, formData);
    } catch (err: any) {
      if (err?.digest?.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      alert("驳回失败：" + (err?.message || "未知错误"));
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">审核操作</div>
        <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700">待核实 CANDIDATE</span>
      </div>

      {/* POSSIBLE_MATCH 特别警告 */}
      {relationType === "POSSIBLE_MATCH" && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <div className="text-xs font-medium text-amber-700">⚠ 当前为候选匹配 POSSIBLE_MATCH</div>
          <div className="text-xs text-amber-600 mt-1">
            技术等价性尚未确认。VERIFY 只代表管理员验证了数据库中的这条关系记录，
            不代表已确认完全可互换、OEM replacement 或 SAME_PART。
            relationType 不会自动改变。
          </div>
        </div>
      )}

      {!showRejectForm ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleVerify}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            验证关系
          </button>
          <button
            type="button"
            onClick={() => setShowRejectForm(true)}
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            驳回关系
          </button>
        </div>
      ) : (
        <form onSubmit={handleReject} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">驳回原因（必填，2-2000 字符）</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请说明驳回原因，例如：技术资料不足、尺寸不匹配、非同一物理件等"
              rows={3}
              className="border rounded px-3 py-2 text-sm w-full"
              maxLength={2000}
            />
            <div className="text-xs text-gray-400 mt-1">{reason.length}/2000</div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              确认驳回
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              disabled={submitting}
              className="border px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <div className="text-xs text-gray-400 border-t pt-2">
        注意：VERIFY / REJECT 只更新 PartNumberCrossReference 记录，不会修改任何 Part Number / Equipment / Product 数据。
      </div>
    </div>
  );
}
