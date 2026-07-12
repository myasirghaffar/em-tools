"use client";

import { useEffect, useMemo, useState } from "react";

export const ADMIN_TABLE_PAGE_SIZE = 10;

/**
 * Client-side pagination for admin data tables. Resets to page 1 when any
 * `resetDeps` value changes (e.g. search text, filters).
 */
export function useAdminTablePagination<T>(items: T[], ...resetDeps: unknown[]) {
  const [page, setPage] = useState(1);
  const resetKey = JSON.stringify(resetDeps);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages =
    items.length === 0 ? 0 : Math.ceil(items.length / ADMIN_TABLE_PAGE_SIZE);

  useEffect(() => {
    if (totalPages === 0) return;
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    if (items.length === 0) return [];
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * ADMIN_TABLE_PAGE_SIZE;
    return items.slice(start, start + ADMIN_TABLE_PAGE_SIZE);
  }, [items, page, totalPages]);

  const { startItem, endItem } = useMemo(() => {
    if (items.length === 0) {
      return { startItem: 0, endItem: 0 };
    }
    const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));
    return {
      startItem: (safePage - 1) * ADMIN_TABLE_PAGE_SIZE + 1,
      endItem: Math.min(safePage * ADMIN_TABLE_PAGE_SIZE, items.length),
    };
  }, [items.length, page, totalPages]);

  return {
    page,
    setPage,
    pageItems,
    totalPages,
    totalItems: items.length,
    startItem,
    endItem,
  };
}
