import type { ReactNode } from "react";

export const btn = {
  base: "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
  primary: "bg-slate-900 text-white hover:bg-slate-700",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

export function Card({
  as: Tag = "section",
  children,
  className = "",
}: {
  as?: "section" | "article" | "aside" | "div";
  children: ReactNode;
  className?: string;
}) {
  return <Tag className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</Tag>;
}

export function Spinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-8 text-sm text-slate-500">
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
      />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "green" | "red" | "amber" | "gray" | "blue"; children: ReactNode }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    gray: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
