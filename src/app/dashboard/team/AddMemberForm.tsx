"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Plus, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { addTeamMember, type TeamActionResult } from "./actions";

const initialState: TeamActionResult = { success: false };

export default function AddMemberForm() {
  const [state, formAction] = useFormState(addTeamMember, initialState);

  return (
    <form action={formAction} className="grid sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          姓名 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          required
          placeholder="采购员姓名"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          邮箱 <span className="text-red-500">*</span>
        </label>
        <input
          name="email"
          type="email"
          required
          placeholder="用于登录"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">手机号</label>
        <input
          name="phone"
          placeholder="手机号"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">岗位角色</label>
        <input
          name="position"
          defaultValue="采购员"
          placeholder="如：采购经理 / 采购员"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          初始密码 <span className="text-red-500">*</span>
        </label>
        <input
          name="password"
          required
          minLength={6}
          placeholder="至少 6 位，子账号登录后可在「密码修改」中自行修改"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {state.success && state.message && (
        <div className="sm:col-span-2 flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {state.message}
        </div>
      )}
      {!state.success && state.error && (
        <div className="sm:col-span-2 flex items-center gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <XCircle className="w-4 h-4 shrink-0" /> {state.error}
        </div>
      )}

      <div className="sm:col-span-2">
        <SubmitButton />
        <p className="text-xs text-slate-400 mt-2">
          子账号共享企业认证状态、等级权益与全部企业询价数据；仅主账号可管理团队。
        </p>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      {pending ? "提交中…" : "添加采购员"}
    </button>
  );
}
