"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Parse `YYYY-MM-DD` as local calendar date (no UTC shift). */
export function parseISODateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

export function formatISODateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Display as dd/mm/yyyy */
export function formatDateDisplayGB(iso: string): string {
  const d = parseISODateLocal(iso);
  if (!d) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** `YYYY-MM-DDTHH:mm` (datetime-local string, local wall time). */
export function parseDatetimeLocalValue(s: string): { date: string; hhmm: string } | null {
  const t = s.trim();
  if (!t) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(t);
  if (m) {
    return { date: m[1], hhmm: `${m[2]}:${m[3]}` };
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: formatISODateLocal(d),
    hhmm: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

function mergeDateAndTime(dateIso: string, hhmm: string): string {
  const p = parseISODateLocal(dateIso);
  if (!p) return "";
  const parts = hhmm.split(":");
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  p.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  return `${formatISODateLocal(p)}T${pad2(p.getHours())}:${pad2(p.getMinutes())}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Monday = 0 … Sunday = 6 */
function mondayIndexFromSunday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function buildMonthWeeks(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const pad = mondayIndexFromSunday(first);
  const cells: (number | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let day = 1; day <= lastDay; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

const EST_PANEL_HEIGHT_PX = 320;

function pickVerticalPlacement(
  rect: DOMRect,
  panelHeight: number,
  mode: "below" | "above" | "auto",
): "above" | "below" {
  if (mode === "above") return "above";
  if (mode === "below") return "below";
  const gap = 4;
  const pad = 8;
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;
  const need = panelHeight + pad;
  const fitsBelow = spaceBelow >= need;
  const fitsAbove = spaceAbove >= need;
  if (fitsBelow) return "below";
  if (fitsAbove) return "above";
  return spaceAbove > spaceBelow ? "above" : "below";
}

export type DatePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Extra classes on the trigger (full width in forms) */
  triggerClassName?: string;
  /**
   * `auto` picks above/below from viewport space (default).
   * Fixed `above` / `below` skips measurement.
   */
  dropdownPosition?: "below" | "above" | "auto";
  /** Panel min width (calendar needs space beyond narrow triggers) */
  minPanelWidthPx?: number;
  /**
   * When true, value/onChange use `YYYY-MM-DDTHH:mm` (datetime-local).
   * Panel includes a time row; picking a day keeps the popup open.
   */
  withTime?: boolean;
};

export default function DatePickerField({
  id: idProp,
  value,
  onChange,
  placeholder,
  disabled,
  className = "",
  triggerClassName = "",
  dropdownPosition = "auto",
  minPanelWidthPx = 288,
  withTime = false,
}: DatePickerFieldProps) {
  const autoId = useId();
  const id = idProp ?? `date-field-${autoId}`;
  const panelId = `${id}-panel`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const [view, setView] = useState<Date>(() => {
    const dateStr = withTime ? parseDatetimeLocalValue(value)?.date : value;
    const p = dateStr ? parseISODateLocal(dateStr) : null;
    return p ? startOfMonth(p) : startOfMonth(new Date());
  });

  const resolvedPlaceholder =
    placeholder ?? (withTime ? "dd/mm/yyyy · hh:mm" : "dd/mm/yyyy");

  const display = withTime
    ? (() => {
        const p = parseDatetimeLocalValue(value);
        if (!p) return "";
        return `${formatDateDisplayGB(p.date)} · ${p.hhmm}`;
      })()
    : formatDateDisplayGB(value);

  useEffect(() => {
    if (!open) return;
    const dateStr = withTime ? parseDatetimeLocalValue(value)?.date : value;
    const p = dateStr ? parseISODateLocal(dateStr) : null;
    if (p) setView(startOfMonth(p));
  }, [open, value, withTime]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }

    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 4;
      const w = Math.max(minPanelWidthPx, rect.width);
      let left = rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));

      const measured = panelRef.current?.offsetHeight;
      const ph =
        measured != null && measured > 48 ? measured : EST_PANEL_HEIGHT_PX;
      const placement = pickVerticalPlacement(rect, ph, dropdownPosition);

      if (placement === "above") {
        setPanelStyle({
          position: "fixed",
          left,
          width: w,
          bottom: window.innerHeight - rect.top + gap,
          zIndex: 200,
          boxSizing: "border-box",
        });
      } else {
        setPanelStyle({
          position: "fixed",
          top: rect.bottom + gap,
          left,
          width: w,
          zIndex: 200,
          boxSizing: "border-box",
        });
      }
    };

    update();
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(update);
    });

    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [open, dropdownPosition, minPanelWidthPx, withTime, value, view]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      const panel = document.getElementById(panelId);
      if (panel?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, panelId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const y = view.getFullYear();
  const m = view.getMonth();
  const weeks = buildMonthWeeks(y, m);

  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth();
  const td = today.getDate();

  const dateOnly = withTime ? (parseDatetimeLocalValue(value)?.date ?? "") : value;
  const selected = parseISODateLocal(dateOnly);

  const pickDay = (day: number) => {
    const isoDate = formatISODateLocal(new Date(y, m, day));
    if (withTime) {
      const prev = parseDatetimeLocalValue(value);
      const hhmm =
        prev?.hhmm ??
        `${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())}`;
      onChange(mergeDateAndTime(isoDate, hhmm));
    } else {
      onChange(isoDate);
      setOpen(false);
    }
  };

  const monthTitle = view.toLocaleString("en-GB", { month: "long", year: "numeric" });

  const timeValue = (() => {
    if (!withTime) return "12:00";
    const p = parseDatetimeLocalValue(value);
    if (p) return p.hhmm;
    return `${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())}`;
  })();

  const onTimeChange = (hhmm: string) => {
    let datePart = parseDatetimeLocalValue(value)?.date;
    if (!datePart) {
      datePart = formatISODateLocal(new Date());
    }
    onChange(mergeDateAndTime(datePart, hhmm));
  };

  const panel =
    open && panelStyle ? (
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label={withTime ? "Choose date and time" : "Choose date"}
        style={panelStyle}
        className="overflow-hidden rounded-xl border border-gray-200 bg-white py-3 shadow-lg ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-[#FF7A00]"
      >
        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Previous month"
            onClick={() => setView(new Date(y, m - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-0 flex-1 text-center text-sm font-semibold text-slate-900">
            {monthTitle}
          </span>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Next month"
            onClick={() => setView(new Date(y, m + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 px-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="space-y-0.5 px-2 pb-1">
          {weeks.map((row, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-0.5">
              {row.map((day, di) => {
                if (day == null) {
                  return <div key={`e-${wi}-${di}`} className="h-9" />;
                }
                const isSelected =
                  selected != null &&
                  selected.getFullYear() === y &&
                  selected.getMonth() === m &&
                  selected.getDate() === day;
                const isTodayCell = ty === y && tm === m && td === day;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickDay(day)}
                    className={[
                      "flex h-9 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                      isSelected
                        ? "bg-[#FF7A00] text-white hover:bg-[#e86e00]"
                        : isTodayCell
                          ? "ring-1 ring-[#FF7A00] ring-inset text-slate-900 hover:bg-[#FF7A00]/10"
                          : "text-slate-800 hover:bg-[#FF7A00]/12",
                    ].join(" ")}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {withTime ? (
          <div className="border-t border-gray-100 px-3 pt-2">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Time
            </label>
            <input
              type="time"
              step={60}
              value={timeValue}
              onChange={(e) => onTimeChange(e.target.value)}
              disabled={disabled}
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
            />
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <div className={`relative w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={[
          "flex w-full min-h-[2.5rem] cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm transition",
          "hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FF7A00] disabled:cursor-not-allowed disabled:opacity-50",
          display ? "text-slate-900" : "text-slate-400",
          triggerClassName,
        ].join(" ")}
      >
        <span className="min-w-0 flex-1">{display || resolvedPlaceholder}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
