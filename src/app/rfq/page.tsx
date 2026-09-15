import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// /rfq 旧地址 → 统一跳转到 /rfqs（列表页正式 URL）
export default function RFQListRedirect() {
  redirect("/rfqs");
}
