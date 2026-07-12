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
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string };

export type SelectProps = {
  label?: string;
  error?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Shown when no option matches `value` */
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Extra classes on the trigger (e.g. pill colors in tables) */
  triggerClassName?: string;
  /** `sm` for compact table controls */
  size?: "sm" | "md";
  /** Open menu above trigger (helps inside scroll tables) */
  dropdownPosition?: "below" | "above";
  /** Light (default) or dark panel with optional checkmark on the active option */
  menuTone?: "light" | "dark";
  id?: string;
  name?: string;
  /** When set with `label`, overrides label element classes */
  labelClassName?: string;
};

export default function Select({
  label,
  error,
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
  required,
  className = "",
  triggerClassName = "",
  size = "md",
  dropdownPosition = "below",
  menuTone = "light",
  id: idProp,
  name,
  labelClassName,
}: SelectProps) {
  const autoId = useId();
  const id = idProp ?? `select-${autoId}`;
  const listId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  useEffect(() => {
    if (!open) return;
    const i = options.findIndex((o) => o.value === value);
    setHighlight(i >= 0 ? i : 0);
  }, [open, options, value]);

  /** Focus listbox once it exists in the portal (after `menuStyle` is set). */
  useLayoutEffect(() => {
    if (!open || !menuStyle) return;
    const t = window.requestAnimationFrame(() => listRef.current?.focus());
    return () => window.cancelAnimationFrame(t);
  }, [open, menuStyle]);

  /** Fixed + portal: list is outside the trigger tree, so it is not clipped by overflow-hidden / scroll parents. */
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
      const maxMenuPx = 240; /* matches max-h-60 */
      if (dropdownPosition === "above") {
        const spaceAbove = rect.top - gap - 8;
        setMenuStyle({
          position: "fixed",
          left: rect.left,
          width: rect.width,
          bottom: window.innerHeight - rect.top + gap,
          maxHeight: Math.min(maxMenuPx, Math.max(64, spaceAbove)),
          zIndex: 200,
          boxSizing: "border-box",
        });
      } else {
        const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
        setMenuStyle({
          position: "fixed",
          top: rect.bottom + gap,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.min(maxMenuPx, Math.max(64, spaceBelow)),
          zIndex: 200,
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
  }, [open, dropdownPosition]);

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

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
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

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt) pick(opt.value);
    }
  };

  const triggerSize =
    size === "sm"
      ? "h-8 min-h-0 px-2.5 py-0 text-xs font-medium"
      : "box-border h-11 min-h-0 px-4 py-0 text-sm font-medium";

  const listbox = open && menuStyle ? (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      tabIndex={0}
      style={menuStyle}
      onKeyDown={onListKeyDown}
      className={[
        "overflow-auto rounded-xl border py-1 outline-none focus:ring-2",
        menuTone === "dark"
          ? "border-slate-600/90 bg-slate-800 py-1.5 shadow-xl ring-1 ring-black/25 focus:ring-[#FF7A00]/50"
          : "border-gray-200 bg-white shadow-lg ring-1 ring-black/5 focus:ring-[#FF7A00]",
      ].join(" ")}
    >
      {options.map((opt, index) => {
        const active = index === highlight;
        const isSelected = opt.value === value;
        const rowDark =
          menuTone === "dark"
            ? [
                "flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm text-white",
                active ? "bg-slate-700/95" : "hover:bg-slate-700/70",
                isSelected ? "font-medium" : "",
              ].join(" ")
            : [
                "flex cursor-pointer items-center px-3 py-2.5 text-sm text-gray-900",
                active ? "bg-[#FF7A00]/12" : "hover:bg-gray-50",
                isSelected ? "font-semibold" : "",
              ].join(" ");
        return (
          <li
            key={opt.value === "" ? "__empty__" : opt.value}
            role="option"
            aria-selected={isSelected}
            onMouseEnter={() => setHighlight(index)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(opt.value)}
            className={rowDark}
          >
            {menuTone === "dark" ? (
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center"
                aria-hidden
              >
                {isSelected ? (
                  <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
                ) : null}
              </span>
            ) : null}
            <span className="min-w-0 flex-1">{opt.label}</span>
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <div className={`relative w-full ${className}`}>
      {label ? (
        <label
          htmlFor={id}
          className={
            labelClassName ?? "mb-1 block text-sm font-medium text-gray-700"
          }
        >
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={[
          "flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white text-left text-slate-800 transition",
          "hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FF7A00] disabled:cursor-not-allowed disabled:opacity-50",
          triggerSize,
          triggerClassName,
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {listbox ? createPortal(listbox, document.body) : null}

      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
