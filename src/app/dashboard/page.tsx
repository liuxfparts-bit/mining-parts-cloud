import Link from "next/link";

function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-8">
      <div className="flex gap-6">
        <aside className="w-48 shrink-0">
          <h3 className="font-bold mb-4">控制台</h3>
          <nav className="space-y-2 text-sm">
            <Link href="/dashboard" className="block text-muted hover:text-accent">概览</Link>
            <Link href="/dashboard/company" className="block text-muted hover:text-accent">企业资料</Link>
            <Link href="/dashboard/products" className="block text-muted hover:text-accent">我的产品</Link>
            <Link href="/dashboard/equipment" className="block text-muted hover:text-accent">设备管理</Link>
            <Link href="/dashboard/part-numbers" className="block text-muted hover:text-accent">件号管理</Link>
            <Link href="/dashboard/rfqs" className="block text-muted hover:text-accent">我的询价</Link>
            <Link href="/dashboard/quotes" className="block text-muted hover:text-accent">报价管理</Link>
          </nav>
        </aside>
        <main className="flex-1">
          <h1 className="text-2xl font-bold mb-2">{title}</h1>
          <p className="text-muted mb-6">{desc}</p>
          <div className="bg-white border border-line rounded-lg p-12 text-center text-muted">
            模块建设中
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <Placeholder title="控制台概览" desc="欢迎回到矿配云供应商控制台" />;
}
