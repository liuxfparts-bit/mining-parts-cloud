"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveCompany, rejectCompany } from "../../../actions";

export default function ReviewButtons({ id }: { id: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  function approve() {
    setErr("");
    start(async () => {
      await approveCompany(String(id));
    });
  }

  function doReject() {
    if (!reason.trim()) {
      setErr("请填写驳回原因");
      return;
    }
    start(async () => {
      await rejectCompany(String(id), reason);
    });
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="font-bold mb-4">审核操作</h2>
      {err && <div className="text-red-600 text-sm mb-3">{err}</div>}
      <div className="flex gap-3">
        <button onClick={approve} disabled={pending} className="bg-green-600 text-white px-6 py-2 rounded disabled:opacity-50">
          {pending ? "处理中..." : "✓ 审核通过"}
        </button>
        <button onClick={() => setShowReason(!showReason)} disabled={pending} className="bg-red-100 text-red-700 px-6 py-2 rounded">
          ✕ 驳回
        </button>
      </div>
      {showReason && (
        <div className="mt-4">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请输入驳回原因"
            className="border rounded px-3 py-2 text-sm w-full mb-2"
          />
          <button onClick={doReject} disabled={pending} className="bg-red-600 text-white px-6 py-2 rounded">
            确认驳回
          </button>
        </div>
      )}
    </div>
  );
}
