"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type PaginationProps = {
  /** Current page (1-based). */
  page: number;
  /** Total number of pages (minimum 1 when there are items). */
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Optional “Showing a–b of c” copy (all 1-based indices; pass totalItems for c). */
  startItem?: number;
  endItem?: number;
  totalItems?: number;
  className?: string;
  /** Tighter controls for admin tables. */
  size?: "default" | "compact";
  /** Hide the whole control when there is only one page (default: true). */
  hideWhenSinglePage?: boolean;
};

function visiblePageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 1) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let d = -1; d <= 1; d++) {
    const p = current + d;
    if (p >= 1 && p <= total) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) {
      out.push("ellipsis");
    }
    out.push(sorted[i]!);
  }
  return out;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  startItem,
  endItem,
  totalItems,
  className = "",
  size = "default",
  hideWhenSinglePage = true,
}: PaginationProps) {
  if (totalPages <= 0) {
    return null;
  }
  if (hideWhenSinglePage && totalPages <= 1) {
    return null;
  }

  const current = Math.min(Math.max(1, page), totalPages);
  const pages = visiblePageNumbers(current, totalPages);

  const btn =
    size === "compact"
      ? "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-[#0B2A4A] transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
      : "inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-semibold text-[#0B2A4A] transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40";

  const pageBtn = (active: boolean) =>
    [
      size === "compact" ? "h-8 min-w-8 text-xs" : "h-10 min-w-10 text-sm",
      "inline-flex items-center justify-center rounded-xl font-semibold transition-colors",
      active
        ? "bg-[#FF7A00] text-white shadow-sm ring-1 ring-[#FF7A00]/30"
        : "border border-gray-200 bg-white text-[#0B2A4A] hover:bg-gray-50",
    ].join(" ");

  const showRange =
    typeof startItem === "number" &&
    typeof endItem === "number" &&
    typeof totalItems === "number";

  return (
    <nav
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
      aria-label="Pagination"
    >
      {showRange ? (
        <p className="text-sm text-gray-600">
          Showing{" "}
          <span className="font-semibold tabular-nums text-[#0B2A4A]">{startItem}</span>
          {"–"}
          <span className="font-semibold tabular-nums text-[#0B2A4A]">{endItem}</span>
          {" of "}
          <span className="font-semibold tabular-nums text-[#0B2A4A]">{totalItems}</span>
        </p>
      ) : (
        <span className="text-sm text-gray-500">
          Page {current} of {totalPages}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <button
          type="button"
          className={btn}
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className={size === "compact" ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
        </button>
        {pages.map((item, idx) =>
          item === "ellipsis" ? (
            <span
              key={`e-${idx}`}
              className="inline-flex min-w-8 items-center justify-center text-gray-400"
              aria-hidden
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={pageBtn(item === current)}
              onClick={() => onPageChange(item)}
              aria-label={`Page ${item}`}
              aria-current={item === current ? "page" : undefined}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className={btn}
          disabled={current >= totalPages}
          onClick={() => onPageChange(current + 1)}
          aria-label="Next page"
        >
          <ChevronRight className={size === "compact" ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
