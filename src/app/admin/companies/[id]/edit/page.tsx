import { redirect } from "next/navigation";

export default function Page({ params }: { params: { id: string } }) {
  redirect(`/admin/suppliers/${params.id}/edit`);
}
