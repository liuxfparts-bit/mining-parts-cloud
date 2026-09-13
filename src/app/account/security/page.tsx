import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="container py-10 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">修改密码</h1>
      <form id="cp-form" className="space-y-4 bg-white border rounded p-6">
        <div>
          <label className="block text-sm mb-1">原密码</label>
          <input name="oldPassword" type="password" required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">新密码</label>
          <input name="newPassword" type="password" required minLength={8}
            className="w-full border rounded px-3 py-2" placeholder="至少 8 位，含字母数字" />
        </div>
        <button className="bg-blue-600 text-white px-5 py-2 rounded">提交</button>
      </form>
      <div id="cp-msg" className="mt-4 text-sm"></div>
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('cp-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = e.target;
          const r = await fetch('/api/account/change-password', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ oldPassword: f.oldPassword.value, newPassword: f.newPassword.value })
          });
          const j = await r.json();
          document.getElementById('cp-msg').textContent = j.ok ? '密码已修改' : (j.message || '失败');
          document.getElementById('cp-msg').style.color = j.ok ? 'green' : 'red';
        });
      `}} />
    </div>
  );
}
