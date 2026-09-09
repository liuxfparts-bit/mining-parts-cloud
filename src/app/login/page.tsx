export default function LoginPage() {
  return (
    <div className="container py-[42px]">
      <div className="max-w-[400px] mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-center">登录</h1>
        <div className="bg-white border border-line rounded-lg p-8">
          <div className="space-y-4">
            <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="手机号 / 邮箱" />
            <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="密码" type="password" />
            <button className="w-full bg-dark text-white font-bold py-2.5 rounded-md">登录</button>
          </div>
          <p className="text-xs text-muted text-center mt-4">
            没有账号？<a href="/register" className="text-accent">立即注册</a>
          </p>
        </div>
      </div>
    </div>
  );
}
