export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function BuyerCompany() {
  const s = await auth();
  if (!s) redirect("/login");
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">我的资料</h1>
      <div className="bg-white border rounded-lg p-6 text-sm">
        <p>采购商账号：{(s.user as any).email}</p>
        <p className="mt-2 text-gray-500">采购商不需要企业认证，可直接在平台搜索件号、发起询价。</p>
      </div>
    </div>
  );
}
