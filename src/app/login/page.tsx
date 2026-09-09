import { signIn, auth } from "@/lib/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; registered?: string };
}) {
  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect("/login?error=1");
      }
      throw error;
    }
  }

  // 已登录则按角色跳转
  const session = await auth();
  if (session?.user) {
    const role = (session.user as any).role;
    if (role === "ADMIN") redirect("/admin");
    redirect("/dashboard");
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-slate-50 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">登录</h1>
        <p className="text-sm text-slate-500 text-center mb-8">矿配云</p>

        {searchParams.error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">邮箱或密码错误</div>
        )}
        {searchParams.registered && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">注册成功，请登录</div>
        )}

        <form action={login} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
            <input name="email" type="email" required
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
            <input name="password" type="password" required
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••" />
          </div>
          <button type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700">
            登录
          </button>
        </form>
      </div>
    </div>
  );
}
