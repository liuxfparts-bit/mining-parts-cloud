"use client";

import { useTransition } from "react";
import { acceptQuote } from "@/app/dashboard/quotes/actions";
import { withdrawMyQuote } from "@/app/supplier/quotes/actions";

export function AcceptQuoteButton({ rfqId, quoteId }: { rfqId: number; quoteId: number }) {
  const [pending, startTransition] = useTransition();
  return <button disabled={pending} onClick={() => {
    if (!confirm("确定接受该供应商报价？接受后，该询价将进入“已选定”，其他待处理报价将标记为“未选中”。")) return;
    startTransition(async () => { try { await acceptQuote(rfqId, quoteId); } catch (e) { alert(e instanceof Error ? e.message : "操作失败"); } });
  }} className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{pending ? "处理中…" : "接受报价"}</button>;
}

export function WithdrawQuoteButton({ quoteId }: { quoteId: number }) {
  const [pending, startTransition] = useTransition();
  return <button disabled={pending} onClick={() => {
    if (!confirm("确定撤回这份报价？撤回后不能恢复。")) return;
    startTransition(async () => { try { await withdrawMyQuote(quoteId); } catch (e) { alert(e instanceof Error ? e.message : "操作失败"); } });
  }} className="border border-red-300 text-red-700 rounded-lg px-5 py-2 text-sm disabled:opacity-50">{pending ? "处理中…" : "撤回报价"}</button>;
}
