"use client";

import { useRef, useState } from "react";
import { REJECT_REASONS } from "@/lib/rfq-invitation";
import { rejectInvitationAction } from "./actions";

export default function RespondClient({ invitationId }: { invitationId: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [other, setOther] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function submit() {
    const finalReason = reason === "其他" && other.trim() ? `其他：${other.trim()}` : reason;
    if (!finalReason) return setError("请填写原因");
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.set("invitationId", String(invitationId));
    fd.set("reason", finalReason);
    const res = await rejectInvitationAction(fd);
    setLoading(false);
    if (res && !res.success) {
      setError(res.error || "提交失败");
    } else {
      formRef.current?.reset();
      setOpen(false);
      window.location.reload();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-gray-300 text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-50"
      >
        暂不报价
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-1">暂不报价</h3>
            <p className="text-sm text-gray-500 mb-4">请选择暂不报价的原因（将反馈给采购方）</p>
            <form ref={formRef} action={() => {}} className="space-y-3">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {reason === "其他" && (
                <input
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  placeholder="请说明具体原因"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 border rounded text-sm"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50"
                >
                  {loading ? "提交中..." : "确认暂不报价"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
