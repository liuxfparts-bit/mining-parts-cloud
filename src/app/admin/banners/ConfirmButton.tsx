"use client";

export default function ConfirmButton({ formAction, confirmText, children, className, id }: { formAction: (fd: FormData) => void; confirmText: string; children: React.ReactNode; className?: string; id: string }) {
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={className} onClick={(e) => { if (!confirm(confirmText)) e.preventDefault(); }}>{children}</button>
    </form>
  );
}
