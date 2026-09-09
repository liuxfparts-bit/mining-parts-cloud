"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

const initialState = { error: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="bg-accent text-ink hover:bg-[#d49215]">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      {pending ? "提交中..." : "提交报价"}
    </Button>
  );
}

export default function QuoteForm({ rfqId, supplierId }: { rfqId: number; supplierId: number }) {
  const [state, formAction] = useFormState(async (prev: any, formData: FormData) => {
    formData.append("rfqId", String(rfqId));
    formData.append("supplierId", String(supplierId));
    const res = await fetch("/api/quote", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) return { error: "提交失败" };
    window.location.href = `/rfq/${rfqId}`;
    return { error: "" };
  }, initialState);

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold mb-1">单价 (Unit Price) *</label>
          <Input name="unitPrice" type="number" step="0.01" required placeholder="0.00" />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">币种 (Currency)</label>
          <select name="currency" className="flex h-10 w-full rounded-md border border-[#dce2e6] bg-white px-3 py-2 text-sm">
            <option value="CNY">CNY 人民币</option>
            <option value="USD">USD 美元</option>
            <option value="EUR">EUR 欧元</option>
            <option value="RUB">RUB 卢布</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">库存状态</label>
          <select name="stockStatus" className="flex h-10 w-full rounded-md border border-[#dce2e6] bg-white px-3 py-2 text-sm">
            <option value="IN_STOCK">现货</option>
            <option value="MADE_TO_ORDER">按单生产</option>
            <option value="OUT_OF_STOCK">无货</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">交期 (Lead Time)</label>
          <Input name="leadTime" placeholder="例如：15-20天" />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">最小起订量 (MOQ)</label>
          <Input name="moq" type="number" min="1" placeholder="1" />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">质保 (Warranty)</label>
          <Input name="warranty" placeholder="例如：12个月" />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">付款条件 (Payment Terms)</label>
          <Input name="paymentTerms" placeholder="例如：30%预付，70%见提单" />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">贸易条款 (Incoterm)</label>
          <select name="incoterm" className="flex h-10 w-full rounded-md border border-[#dce2e6] bg-white px-3 py-2 text-sm">
            <option value="">选择</option>
            <option value="EXW">EXW</option>
            <option value="FOB">FOB</option>
            <option value="CIF">CIF</option>
            <option value="DDP">DDP</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold mb-1">备注 (Remarks)</label>
          <textarea
            name="remarks"
            rows={3}
            placeholder="补充说明、替代件号、包装方式等"
            className="flex min-h-[80px] w-full rounded-md border border-[#dce2e6] bg-white px-3 py-2 text-sm placeholder:text-muted"
          />
        </div>
      </div>

      {state.error && <p className="text-red-500 text-sm">{state.error}</p>}

      <div className="flex justify-end gap-3 pt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={() => history.back()}>取消</Button>
        <SubmitButton />
      </div>
    </form>
  );
}
