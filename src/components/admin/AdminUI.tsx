import type { ReactNode } from "react";
import Pagination from "../ui/Pagination";

export function AdminPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function AdminPanel({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-2xl bg-white p-4 outline outline-1 outline-offset-[-1px] outline-gray-200 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function AdminTableShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white outline outline-1 outline-offset-[-1px] outline-gray-200 overflow-hidden">
      {children}
    </div>
  );
}

export function StatusPill({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
}) {
  const styles: Record<string, string> = {
    default: "bg-gray-100 text-gray-600",
    success: "bg-emerald-100 text-emerald-600",
    warning: "bg-amber-100 text-amber-600",
    danger: "bg-rose-100 text-rose-600",
    info: "bg-blue-100 text-blue-600",
    purple: "bg-[#FF7A00]/12 text-[#FF7A00]",
  };

  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-3 text-xs font-bold ${styles[variant] || styles.default}`}
    >
      {label}
    </span>
  );
}

/** Compact footer for admin data tables; uses shared `Pagination` (hidden when ≤1 page). */
export function AdminTablePagination({
  page,
  totalPages,
  onPageChange,
  startItem,
  endItem,
  totalItems,
  enabled = true,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  startItem: number;
  endItem: number;
  totalItems: number;
  enabled?: boolean;
}) {
  if (!enabled || totalPages <= 1) return null;
  return (
    <div className="border-t border-gray-200 bg-slate-50/90 px-4 py-3 sm:px-6">
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        startItem={startItem}
        endItem={endItem}
        totalItems={totalItems}
        size="compact"
      />
    </div>
  );
}
