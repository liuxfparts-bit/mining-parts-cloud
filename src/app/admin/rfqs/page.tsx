function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <div className="bg-white border border-line rounded-lg p-12 text-center text-muted">管理功能建设中</div>
    </div>
  );
}
export default function AdminRFQsPage() { return <AdminPlaceholder title="询价管理" />; }
