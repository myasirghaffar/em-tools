"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { useScrollLock } from "../../hooks/useScrollLock";

export type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the user confirms; may be async — use `confirmLoading` while a request runs */
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions (delete) use a red primary button */
  variant?: "default" | "danger";
  /** Disables actions and shows loading on the confirm control */
  confirmLoading?: boolean;
};

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  variant = "default",
  confirmLoading = false,
}: ConfirmDialogProps) {
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmLoading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, confirmLoading]);

  if (!isOpen) return null;

  const busy = confirmLoading;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={(e) => {
        if (busy) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/80"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-1 rounded-t-2xl bg-gradient-to-r from-[#FF7A00] via-amber-400 to-[#FF7A00]"
          aria-hidden
        />
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <h2
            id="confirm-dialog-title"
            className="text-lg font-semibold text-slate-900"
          >
            {title}
          </h2>
          <p id="confirm-dialog-desc" className="mt-2 text-sm text-slate-600">
            {message}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onConfirm()}
              className={[
                "inline-flex min-h-[2.5rem] min-w-[5rem] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60",
                variant === "danger"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-[#FF7A00] hover:bg-[#e86e00]",
              ].join(" ")}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  {variant === "danger" ? "Deleting…" : "Please wait…"}
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
