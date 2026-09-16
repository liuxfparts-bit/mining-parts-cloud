"use client";

import { useState, useTransition } from "react";

type Props = {
  rfqId: number;
  canClose: boolean;
  hasQuotes: boolean;
  closeAction: () => Promise<void>;
  deleteAction: () => Promise<void>;
};

/** 采购商 RFQ 管理操作（关闭 / 删除），删除需二次确认；server action 错误会回显 */
export function RfqDangerActions({ rfqId, canClose, hasQuotes, closeAction, deleteAction }: Props) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function run(fn: () => Promise<void>, okText: string) {
    setMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setMsg(okText);
      } catch (e: any) {
        setMsg(e?.message || "操作失败，请重试");
      }
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {msg && <span className="text-xs text-amber-600">{msg}</span>}
      {canClose && (
        <button
          disabled={isPending}
          onClick={() => run(closeAction, "询价已关闭")}
          className="text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
          关闭询价
        </button>
      )}
      {confirming ? (
        <span className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">
            确定要删除该询价吗？{hasQuotes ? "（该询价已有报价，无法删除，可关闭）" : "删除后不可恢复。"}
          </span>
          <button
            disabled={isPending || hasQuotes}
            onClick={() => run(deleteAction, "询价已删除")}
            className="text-sm bg-red-600 text-white rounded px-3 py-1.5 disabled:opacity-50">
            确认删除
          </button>
          <button onClick={() => setConfirming(false)} className="text-sm border rounded px-3 py-1.5">取消</button>
        </span>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="text-sm border border-red-200 text-red-600 rounded px-3 py-1.5 hover:bg-red-50">
          删除询价
        </button>
      )}
    </div>
  );
}
