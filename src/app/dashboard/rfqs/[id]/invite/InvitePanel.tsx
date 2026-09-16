"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { inviteSuppliersAction } from "../invite-actions";

export interface SupplierOption {
  id: number;
  name: string;
  fullName: string;
  province?: string | null;
  city?: string | null;
  mainBrands?: string | null;
  mainProducts?: string | null;
  verified: boolean;
  memberLevel?: string;
  quoteCount?: number;
  score?: number;
  reasons?: string[];
}

interface ExternalRow {
  key: number;
  company: string;
  contact: string;
  email: string;
  phone: string;
}

export default function InvitePanel({
  rfqId,
  recommended,
  searchData,
  searchMeta,
  mySuppliers,
  invitedSupplierIds,
  initialSearch,
}: {
  rfqId: number;
  recommended: SupplierOption[];
  searchData: SupplierOption[];
  searchMeta: { total: number; page: number; totalPages: number; pageSize: number };
  mySuppliers: SupplierOption[];
  invitedSupplierIds: number[];
  initialSearch: { q: string; province: string; verified: boolean };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [externals, setExternals] = useState<ExternalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // 搜索条件（本地 state + URL 同步）
  const [q, setQ] = useState(initialSearch.q);
  const [province, setProvince] = useState(initialSearch.province);
  const [verified, setVerified] = useState(initialSearch.verified);

  const invitedSet = useMemo(() => new Set(invitedSupplierIds), [invitedSupplierIds]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(list: SupplierOption[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of list) next.add(s.id);
      return next;
    });
  }

  function addExternalRow() {
    setExternals((prev) => [
      ...prev,
      { key: Date.now() + Math.random(), company: "", contact: "", email: "", phone: "" },
    ]);
  }

  async function submit() {
    const supplierIds = Array.from(selected);
    const validExternals = externals.filter(
      (e) => e.company.trim() || e.email.trim() || e.phone.trim()
    );
    if (supplierIds.length === 0 && validExternals.length === 0) {
      setResult({ success: false, message: "请至少选择一家供应商或填写外部供应商信息" });
      return;
    }
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    fd.set("rfqId", String(rfqId));
    for (const sid of supplierIds) fd.append("supplierIds", String(sid));
    validExternals.forEach((e, i) => {
      fd.set(`company_${i}`, e.company);
      fd.set(`contact_${i}`, e.contact);
      fd.set(`email_${i}`, e.email);
      fd.set(`phone_${i}`, e.phone);
    });
    const res = await inviteSuppliersAction(fd);
    setLoading(false);
    if (res && res.success) {
      setResult({ success: true, message: `${res.message}${res.rfqTitle ? `（${res.rfqTitle}）` : ""}` });
      setSelected(new Set());
      setExternals([]);
      router.refresh();
    } else {
      setResult({ success: false, message: (res as any)?.error || "发送失败，请重试" });
    }
  }

  function doSearch() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (province) params.set("province", province);
    if (verified) params.set("verified", "1");
    router.push(`/dashboard/rfqs/${rfqId}/invite?${params.toString()}`);
  }

  function SupplierCard({ s, showScore }: { s: SupplierOption; showScore?: boolean }) {
    const isInvited = invitedSet.has(s.id);
    const isSelected = selected.has(s.id);
    return (
      <div className={`border rounded-lg p-3 flex gap-3 ${isInvited ? "bg-gray-50" : isSelected ? "bg-blue-50 border-blue-300" : ""}`}>
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isInvited}
          onChange={() => toggle(s.id)}
          className="mt-1 h-4 w-4"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <b className="text-sm">{s.name}</b>
            {s.verified && <span className="text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5">已认证</span>}
            {!s.verified && <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">待认证</span>}
            {isInvited && <span className="text-xs bg-orange-100 text-orange-600 rounded px-1.5 py-0.5">已邀请</span>}
          </div>
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
            {s.mainBrands && <span>主营品牌：{s.mainBrands}</span>}
            {s.mainProducts && <span>{s.mainBrands ? " · " : ""}主营产品：{s.mainProducts}</span>}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {s.province || s.city || ""}
            {s.quoteCount != null && s.quoteCount > 0 ? ` · 历史报价 ${s.quoteCount} 次` : ""}
            {showScore && s.score != null ? ` · 匹配度 ${Math.round(Math.min(100, s.score * 10))}` : ""}
          </div>
          {showScore && s.reasons && s.reasons.length > 0 && (
            <div className="text-xs text-blue-600 mt-1">{s.reasons.join("；")}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result && (
        <div className={`border rounded-lg p-4 text-sm ${result.success ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {result.message}
          {result.success && (
            <Link href={`/dashboard/rfqs/${rfqId}`} className="ml-3 underline">查看询价邀请 →</Link>
          )}
        </div>
      )}

      {/* 智能推荐 */}
      <div className="bg-white border rounded-lg p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="font-bold flex items-center gap-2">智能推荐供应商</h2>
            <p className="text-xs text-gray-400 mt-0.5">根据品牌、设备型号、件号及历史报价自动匹配，推荐 {recommended.length} 家</p>
          </div>
          {recommended.length > 0 && (
            <button
              type="button"
              onClick={() => selectAll(recommended.filter((s) => !invitedSet.has(s.id)))}
              className="text-xs border border-blue-600 text-blue-600 rounded px-3 py-1.5 hover:bg-blue-50"
            >
              一键全选并发送邀请
            </button>
          )}
        </div>
        {recommended.length === 0 ? (
          <p className="text-sm text-gray-400">暂无推荐（可继续使用下方供应商库搜索选择）</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-2">
            {recommended.map((s) => (
              <SupplierCard key={s.id} s={s} showScore />
            ))}
          </div>
        )}
      </div>

      {/* 供应商库搜索 */}
      <div className="bg-white border rounded-lg p-5">
        <h2 className="font-bold mb-3">矿配云供应商库</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="公司名 / 件号 / 品牌 / 配件"
            className="col-span-2 border rounded px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
          />
          <input
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            placeholder="地区（省/市）"
            className="border rounded px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
          />
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            仅看已认证
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={doSearch} className="bg-blue-600 text-white rounded px-4 py-2 text-sm">
              搜索
            </button>
            <button
              type="button"
              onClick={() => {
                setQ("");
                setProvince("");
                setVerified(false);
                router.push(`/dashboard/rfqs/${rfqId}/invite`);
              }}
              className="border rounded px-4 py-2 text-sm"
            >
              重置
            </button>
          </div>
        </div>

        {searchData.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">没有找到符合条件的供应商</p>
        ) : (
          <>
            <div className="space-y-2">
              {searchData.map((s) => (
                <SupplierCard key={s.id} s={s} />
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 text-sm">
              <span className="text-xs text-gray-400">共 {searchMeta.total} 家 · 第 {searchMeta.page} / {searchMeta.totalPages} 页</span>
              <div className="flex gap-2">
                {searchMeta.page > 1 && (
                  <Link
                    href={`/dashboard/rfqs/${rfqId}/invite?page=${searchMeta.page - 1}&q=${encodeURIComponent(q)}&province=${encodeURIComponent(province)}${verified ? "&verified=1" : ""}`}
                    className="border rounded px-3 py-1 hover:bg-gray-50"
                  >
                    上一页
                  </Link>
                )}
                {searchMeta.page < searchMeta.totalPages && (
                  <Link
                    href={`/dashboard/rfqs/${rfqId}/invite?page=${searchMeta.page + 1}&q=${encodeURIComponent(q)}&province=${encodeURIComponent(province)}${verified ? "&verified=1" : ""}`}
                    className="border rounded px-3 py-1 hover:bg-gray-50"
                  >
                    下一页
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 我的供应商 */}
      {mySuppliers.length > 0 && (
        <div className="bg-white border rounded-lg p-5">
          <h2 className="font-bold mb-3">我的供应商（历史合作）</h2>
          <div className="grid md:grid-cols-2 gap-2">
            {mySuppliers.map((s) => (
              <SupplierCard key={s.id} s={s} />
            ))}
          </div>
        </div>
      )}

      {/* 外部供应商 */}
      <div className="bg-white border rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">外部供应商</h2>
          <button type="button" onClick={addExternalRow} className="text-xs border border-blue-600 text-blue-600 rounded px-3 py-1.5 hover:bg-blue-50">
            + 添加外部供应商
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">手动录入未入驻平台的供应商，系统将生成专属邀请链接供其注册报价</p>
        {externals.length === 0 ? (
          <p className="text-sm text-gray-400">暂无外部供应商</p>
        ) : (
          <div className="space-y-3">
            {externals.map((e) => (
              <div key={e.key} className="grid grid-cols-2 md:grid-cols-4 gap-2 border rounded-lg p-3">
                <input value={e.company} onChange={(ev) => { e.company = ev.target.value; setExternals([...externals]); }} placeholder="公司名称" className="border rounded px-3 py-2 text-sm" />
                <input value={e.contact} onChange={(ev) => { e.contact = ev.target.value; setExternals([...externals]); }} placeholder="联系人" className="border rounded px-3 py-2 text-sm" />
                <input value={e.email} onChange={(ev) => { e.email = ev.target.value; setExternals([...externals]); }} placeholder="邮箱" className="border rounded px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <input value={e.phone} onChange={(ev) => { e.phone = ev.target.value; setExternals([...externals]); }} placeholder="手机/WhatsApp" className="flex-1 border rounded px-3 py-2 text-sm" />
                  <button
                    type="button"
                    onClick={() => setExternals(externals.filter((x) => x.key !== e.key))}
                    className="text-red-500 text-sm px-2"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 提交 */}
      <div className="sticky bottom-4 bg-white border rounded-lg p-4 flex items-center justify-between shadow">
        <div className="text-sm">
          已选择 <b className="text-blue-600">{selected.size}</b> 家注册供应商
          {externals.filter((e) => e.company || e.email || e.phone).length > 0 && (
            <> + <b className="text-blue-600">{externals.filter((e) => e.company || e.email || e.phone).length}</b> 家外部供应商</>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2.5 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "发送邀请中..." : "发送邀请"}
        </button>
      </div>
    </div>
  );
}
