"use client";

export default function ConfirmButton({ action, confirmText, children, className, id }: { action: (id: number) => void; confirmText: string; children: React.ReactNode; className?: string; id: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => { e.preventDefault(); if (confirm(confirmText)) action(parseInt(id)); }}
    >
      {children}
    </button>
  );
}
