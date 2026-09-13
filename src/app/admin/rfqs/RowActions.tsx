"use client";

import { useState } from "react";
import { setRfqStatus, deleteRfqs } from "./actions";
import { useRouter } from "next/navigation";

export function RowActions({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(s: string) {
    setBusy(true);
    try {
      if (s === "DELETE") {
        if (!confirm("确定删除该询价？")) return;
        await deleteRfqs([id]);
      } else {
        if (s === "CLOSED" && !confirm("确定关闭该询价？")) return;
        await setRfqStatus(id, s);
      }
      router.refresh();
    } catch (e: any) {
      alert("操作失败：" + (e?.message || "请重试"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex gap-1 flex-wrap">
      <a href={`/admin/rfqs/${id}`} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">查看</a>
      {status === "COLLECTING" && (
        <>
          <button disabled={busy} onClick={() => act("CLOSED")} className="px-2 py-1 text-xs bg-gray-100 rounded">下架</button>
          <button disabled={busy} onClick={() => act("REJECTED")} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">驳回</button>
        </>
      )}
      {status === "CLOSED" && (
        <button disabled={busy} onClick={() => act("COLLECTING")} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">重新发布</button>
      )}
      <button disabled={busy} onClick={() => act("DELETE")} className="px-2 py-1 text-xs bg-red-500 text-white rounded">删除</button>
    </div>
  );
}

export function BatchBar({ selected }: { selected: number[] }) {
  const router = useRouter();
  if (selected.length === 0) return null;
  async function del() {
    if (!confirm(`确定删除选中的 ${selected.length} 条询价？`)) return;
    try {
      await deleteRfqs(selected);
      router.refresh();
    } catch (e: any) {
      alert("删除失败：" + (e?.message || "请重试"));
    }
  }
  async function closeAll() {
    if (!confirm(`确定关闭选中的 ${selected.length} 条询价？`)) return;
    try {
      for (const id of selected) await setRfqStatus(id, "CLOSED");
      router.refresh();
    } catch (e: any) {
      alert("操作失败：" + (e?.message || "请重试"));
    }
  }
  return (
    <div className="mb-3 p-2 bg-blue-50 rounded flex gap-3 items-center text-sm">
      <span>已选 {selected.length} 条</span>
      <button onClick={closeAll} className="px-3 py-1 bg-gray-700 text-white rounded text-xs">批量关闭</button>
      <button onClick={del} className="px-3 py-1 bg-red-500 text-white rounded text-xs">批量删除</button>
    </div>
  );
}
