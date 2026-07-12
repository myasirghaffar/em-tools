"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";

export type DropdownMenuLinkItem = {
  id: string;
  label: string;
  to: string;
  danger?: boolean;
};

export type DropdownMenuActionItem = {
  id: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

export type DropdownMenuItem = DropdownMenuLinkItem | DropdownMenuActionItem;

export type DropdownMenuProps = {
  items: DropdownMenuItem[];
  /** Match `Select` compact triggers in data tables */
  size?: "sm" | "md";
  /** Open the panel above the trigger (recommended in scrollable tables) */
  dropdownPosition?: "below" | "above";
  /** Align menu to trigger start (left) or end (right); tables usually need `"end"` */
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
  /** Minimum menu width (px); icon triggers stay readable */
  minMenuWidthPx?: number;
  /** Stack order for portaled menu (default 200 for dense admin tables) */
  zIndex?: number;
  "aria-label"?: string;
  disabled?: boolean;
};

function isLinkItem(item: DropdownMenuItem): item is DropdownMenuLinkItem {
  return "to" in item;
}

export default function DropdownMenu({
  items,
  size = "md",
  dropdownPosition = "below",
  align = "start",
  className = "",
  triggerClassName = "",
  minMenuWidthPx = 176,
  zIndex = 200,
  "aria-label": ariaLabel = "Open menu",
  disabled = false,
}: DropdownMenuProps) {
  const router = useRouter();
  const autoId = useId();
  const menuId = `${autoId}-menu`;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (!open) return;
    setHighlight(0);
  }, [open, items]);

  useLayoutEffect(() => {
    if (!open || !menuStyle) return;
    const t = window.requestAnimationFrame(() => listRef.current?.focus());
    return () => window.cancelAnimationFrame(t);
  }, [open, menuStyle]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const updatePosition = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 4;
      const maxMenuPx = 240;
      const menuWidth = Math.max(minMenuWidthPx, rect.width);
      let left =
        align === "end" ? rect.right - menuWidth : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

      if (dropdownPosition === "above") {
        const spaceAbove = rect.top - gap - 8;
        setMenuStyle({
          position: "fixed",
          left,
          width: menuWidth,
          bottom: window.innerHeight - rect.top + gap,
          maxHeight: Math.min(maxMenuPx, Math.max(64, spaceAbove)),
          zIndex,
          boxSizing: "border-box",
        });
      } else {
        const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
        setMenuStyle({
          position: "fixed",
          top: rect.bottom + gap,
          left,
          width: menuWidth,
          maxHeight: Math.min(maxMenuPx, Math.max(64, spaceBelow)),
          zIndex,
          boxSizing: "border-box",
        });
      }
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, dropdownPosition, align, minMenuWidthPx, zIndex]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, items.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const item = items[highlight];
      if (!item) return;
      if (isLinkItem(item)) {
        router.push(item.to);
      } else {
        item.onSelect();
      }
      setOpen(false);
    }
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const triggerSize =
    size === "sm"
      ? "h-8 min-h-[2rem] w-8 min-w-[2rem] shrink-0 px-0 py-0"
      : "box-border h-11 min-h-[2.75rem] w-11 min-w-[2.75rem] px-0 py-0";

  const listbox =
    open && menuStyle ? (
      <ul
        ref={listRef}
        id={menuId}
        role="menu"
        tabIndex={0}
        style={menuStyle}
        onKeyDown={handleMenuKeyDown}
        className="overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-[#FF7A00]"
      >
        {items.map((item, index) => {
          const active = index === highlight;
          const danger = !!item.danger;
          const rowClass = [
            "flex w-full cursor-pointer items-center px-3 py-2.5 text-sm text-left",
            danger
              ? "text-red-600"
              : "text-gray-900",
            active ? "bg-[#FF7A00]/12" : "",
            !active && (danger ? "hover:bg-red-50" : "hover:bg-gray-50"),
          ].join(" ");

          if (isLinkItem(item)) {
            return (
              <li key={item.id} role="none" className="list-none">
                <Link
                  role="menuitem"
                  href={item.to}
                  className={rowClass}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.id} role="none" className="list-none">
              <button
                type="button"
                role="menuitem"
                className={rowClass}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-slate-800 transition",
          "hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FF7A00] disabled:cursor-not-allowed disabled:opacity-50",
          triggerSize,
          triggerClassName,
        ].join(" ")}
      >
        <MoreVertical className="h-4 w-4 shrink-0 text-gray-600" strokeWidth={2} aria-hidden />
      </button>
      {listbox ? createPortal(listbox, document.body) : null}
    </div>
  );
}
