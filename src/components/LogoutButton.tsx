import { logout } from "@/app/actions-logout";

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-xs text-white/40 hover:text-white transition-colors"
      >
        退出登录
      </button>
    </form>
  );
}
