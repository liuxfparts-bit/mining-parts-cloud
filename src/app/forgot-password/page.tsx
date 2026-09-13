import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "找回密码｜矿配云",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-slate-50 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center mb-2">找回密码</h1>
        <p className="text-sm text-slate-500 text-center mb-6">输入注册邮箱，我们将发送重置链接</p>
        <form action="/forgot-password" method="POST" id="fp-form" className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">邮箱</label>
            <input name="email" type="email" required
              className="w-full border rounded px-3 py-2 text-sm" placeholder="you@example.com" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">发送重置链接</button>
        </form>
        <div id="fp-msg" className="hidden mt-4 p-3 bg-green-50 text-green-700 rounded text-sm"></div>
        <div className="text-center mt-4">
          <a href="/login" className="text-sm text-blue-600">返回登录</a>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('fp-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = e.target.email.value;
          const r = await fetch('/api/auth/forgot-password', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ email })
          });
          const j = await r.json();
          const el = document.getElementById('fp-msg');
          el.textContent = j.message; el.classList.remove('hidden');
        });
      `}} />
    </div>
  );
}
