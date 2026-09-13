import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "重置密码｜矿配云",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token || "";
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-slate-50 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center mb-6">设置新密码</h1>
        {!token && (
          <div className="p-3 bg-red-50 text-red-700 rounded text-sm mb-4">链接无效，请重新申请找回密码。</div>
        )}
        <form id="rp-form" className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="block text-sm font-medium mb-1">新密码</label>
            <input name="password" type="password" required minLength={8}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="至少 8 位，含字母和数字" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">确认新密码</label>
            <input name="confirm" type="password" required minLength={8}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">重置密码</button>
        </form>
        <div id="rp-msg" className="hidden mt-4 p-3 rounded text-sm"></div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('rp-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = e.target;
          const msg = document.getElementById('rp-msg');
          if (f.password.value !== f.confirm.value) {
            msg.textContent = '两次密码不一致'; msg.className = 'mt-4 p-3 rounded text-sm bg-red-50 text-red-700';
            return;
          }
          const r = await fetch('/api/auth/reset-password', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ token: f.token.value, password: f.password.value })
          });
          const j = await r.json();
          if (j.ok) {
            msg.textContent = '密码已重置，即将跳转登录…';
            msg.className = 'mt-4 p-3 rounded text-sm bg-green-50 text-green-700';
            setTimeout(() => location.href = '/login', 1500);
          } else {
            msg.textContent = j.message || '重置失败';
            msg.className = 'mt-4 p-3 rounded text-sm bg-red-50 text-red-700';
          }
        });
      `}} />
    </div>
  );
}
