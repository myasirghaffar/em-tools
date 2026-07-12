"use client";

import { useState } from "react";
import { createLead, type LeadRecord } from "../../lib/api";
import { toastError, toastSuccess } from "../../lib/toast";
import { ButtonSpinner } from "../ui/Button";
import Select from "../ui/Select";

const PRODUCT_INTEREST_OPTIONS = [
  "Solar Panels",
  "Inverters",
  "Batteries",
  "Mounting Systems",
].map((p) => ({ value: p, label: p }));

type Props = {
  /** Called with the new lead so the list can update without a full refetch. */
  onCreated?: (lead: LeadRecord) => void | Promise<void>;
  className?: string;
};

export default function LeadCreateForm({ onCreated, className = "" }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    contact: "",
    location: "",
    productInterest: "Solar Panels",
    notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const created = await createLead({
        name: form.name.trim(),
        contact: form.contact.trim(),
        location: form.location.trim(),
        productInterest: form.productInterest,
        notes: form.notes.trim(),
      });
      setForm({
        name: "",
        contact: "",
        location: "",
        productInterest: "Solar Panels",
        notes: "",
      });
      await onCreated?.(created);
      toastSuccess("Lead created");
    } catch {
      toastError("Could not create lead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={`space-y-3 ${className}`} onSubmit={(e) => void submit(e)}>
      <div>
        <label className="text-xs font-medium text-slate-600">Name</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316]"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600">Contact</label>
        <input
          required
          value={form.contact}
          onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316]"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600">Location</label>
        <input
          required
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316]"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600">Product interest</label>
        <div className="mt-1 relative z-20">
          <Select
            options={PRODUCT_INTEREST_OPTIONS}
            value={form.productInterest}
            onChange={(v) => setForm((f) => ({ ...f, productInterest: v }))}
            triggerClassName="rounded-full"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600">Notes</label>
        <input
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316]"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#F97316] py-2.5 text-sm font-medium text-white hover:bg-[#ea6a0f] disabled:cursor-not-allowed disabled:opacity-60"
        aria-busy={saving}
      >
        {saving ? <ButtonSpinner /> : null}
        {saving ? "Saving…" : "Create lead"}
      </button>
    </form>
  );
}
