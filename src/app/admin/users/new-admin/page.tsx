export default function NewAdminPage() {
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-bold mb-2">创建备用管理员</h1>
      <p className="text-sm text-gray-600 mb-4">使用独立、可长期控制的邮箱。不要与当前唯一管理员共用邮箱或密码。</p>
      <form id="new-admin-form" className="space-y-4 bg-white border rounded p-5">
        <div><label className="block text-sm mb-1">管理员姓名</label><input name="name" required minLength={2} className="w-full border rounded px-3 py-2" /></div>
        <div><label className="block text-sm mb-1">独立邮箱</label><input name="email" type="email" required className="w-full border rounded px-3 py-2" /></div>
        <div><label className="block text-sm mb-1">初始密码</label><input name="password" type="password" required minLength={12} className="w-full border rounded px-3 py-2" placeholder="至少12位，含大小写字母和数字" /></div>
        <button className="bg-blue-600 text-white px-5 py-2 rounded">创建备用管理员</button>
      </form>
      <div id="new-admin-msg" className="mt-4 text-sm"></div>
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('new-admin-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = e.target;
          const r = await fetch('/api/admin/users/create-admin', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ name: f.name.value, email: f.email.value, password: f.password.value })
          });
          const j = await r.json();
          const msg = document.getElementById('new-admin-msg');
          msg.textContent = j.ok ? '备用管理员已创建。请使用该账号完成一次登录验证。' : (j.message || '创建失败');
          msg.style.color = j.ok ? 'green' : 'red';
          if (j.ok) f.reset();
        });
      ` }} />
    </div>
  );
}
