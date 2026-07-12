"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { AdminPanel } from "../../components/admin/AdminUI";
import LeadQuoteBlock from "../../components/leads/LeadQuoteBlock";
import { ButtonSpinner } from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import {
  fetchLead,
  fetchSalesTeam,
  updateLead,
  type LeadRecord,
  type SalesTeamUser,
} from "../../lib/api";
import { toastError, toastSuccess } from "../../lib/toast";

const STATUS = ["New", "Assigned", "In Progress", "Won", "Lost"] as const;
const PRODUCTS = ["Solar Panels", "Inverters", "Batteries", "Mounting Systems"];

const STATUS_OPTIONS = STATUS.map((s) => ({ value: s, label: s }));
const PRODUCT_OPTIONS = PRODUCTS.map((p) => ({ value: p, label: p }));

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const idParam = params?.id;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const listBase = "/leads";

  const id = Number(idParam);
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [salesTeam, setSalesTeam] = useState<SalesTeamUser[]>([]);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    contact: "",
    location: "",
    productInterest: "Solar Panels",
    status: "New" as (typeof STATUS)[number],
    assignedToUserId: "" as string | null,
    notes: "",
  });

  const assignedOptions = useMemo(
    () => [
      { value: "", label: "Unassigned" },
      ...salesTeam.map((s) => ({ value: s.id, label: s.name })),
    ],
    [salesTeam],
  );

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1) return;
    let cancelled = false;
    (async () => {
      setLoadError("");
      try {
        const [l, team] = await Promise.all([
          fetchLead(id),
          isAdmin ? fetchSalesTeam() : Promise.resolve([] as SalesTeamUser[]),
        ]);
        if (cancelled) return;
        setLead(l);
        setSalesTeam(team);
        setForm({
          name: l.name,
          contact: l.contact,
          location: l.location,
          productInterest: l.productInterest,
          status: (STATUS.includes(l.status as (typeof STATUS)[number])
            ? l.status
            : "New") as (typeof STATUS)[number],
          assignedToUserId: l.assignedToUserId,
          notes: l.notes,
        });
      } catch {
        if (!cancelled) {
          setLoadError("Could not load this lead.");
          toastError("Could not load this lead.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isAdmin]);

  useEffect(() => {
    if (typeof window === "undefined" || !lead) return;
    const hash = window.location.hash;
    if (hash !== "#quote" && hash !== "#lead-details") return;
    const targetId = hash === "#quote" ? "lead-quote" : "lead-details";
    const t = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [lead?.id]);

  if (!Number.isFinite(id) || id < 1) {
    return (
      <div className="text-slate-600">
        Invalid lead.{" "}
        <Link href={listBase} className="text-[#F97316] underline">
          Back to leads
        </Link>
      </div>
    );
  }

  if (loadError || !lead) {
    return (
      <div className="text-slate-600">
        {loadError || "Loading…"}{" "}
        <Link href={listBase} className="text-[#F97316] underline">
          Back to leads
        </Link>
      </div>
    );
  }

  async function saveLeadAdmin() {
    if (!isAdmin || saving) return;
    setSaving(true);
    try {
      const updated = await updateLead(id, {
        name: form.name,
        contact: form.contact,
        location: form.location,
        productInterest: form.productInterest,
        status: form.status,
        notes: form.notes,
        assignedToUserId: form.assignedToUserId === "" ? null : form.assignedToUserId,
      });
      setLead(updated);
      toastSuccess("Lead saved");
    } catch {
      toastError("Could not save lead.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotesSales() {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateLead(id, { notes: form.notes });
      setLead(updated);
      toastSuccess("Notes saved");
    } catch {
      toastError("Could not save notes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={listBase} className="text-sm text-[#F97316] hover:underline">
            ← Back to leads
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">Lead #{lead.id}</h1>
          <p className="text-sm text-slate-500">
            Created by {lead.createdByName ?? "—"} · {new Date(lead.createdAt).toLocaleString()}
          </p>
        </div>
        <Link
          href={`/quotes?leadId=${lead.id}`}
          className="text-sm font-medium text-[#F97316] border border-[#F97316] rounded-lg px-3 py-2 hover:bg-[#F97316]/10"
        >
          Open in Quotes workspace
        </Link>
      </div>

      <AdminPanel className="p-4 sm:p-6 scroll-mt-20" id="lead-details">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Lead details</h2>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (isAdmin) void saveLeadAdmin();
          }}
        >
          <div>
            <label className="text-xs font-medium text-slate-600">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={!isAdmin}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Contact</label>
            <input
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              disabled={!isAdmin}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              disabled={!isAdmin}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Product interest</label>
            {isAdmin ? (
              <div className="mt-1 relative z-20">
                <Select
                  options={PRODUCT_OPTIONS}
                  value={
                    PRODUCTS.includes(form.productInterest) ? form.productInterest : PRODUCTS[0]
                  }
                  onChange={(v) => setForm((f) => ({ ...f, productInterest: v }))}
                  triggerClassName="rounded-full"
                />
              </div>
            ) : (
              <p className="mt-1 text-sm py-2 text-slate-800">{form.productInterest}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Status</label>
            {isAdmin ? (
              <div className="mt-1 relative z-20">
                <Select
                  options={STATUS_OPTIONS}
                  value={
                    STATUS.includes(form.status as (typeof STATUS)[number])
                      ? form.status
                      : "New"
                  }
                  onChange={(v) =>
                    setForm((f) => ({ ...f, status: v as (typeof STATUS)[number] }))
                  }
                  triggerClassName="rounded-full"
                />
              </div>
            ) : (
              <p className="mt-1 text-sm py-2 text-slate-800">{form.status}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Assigned to</label>
            {isAdmin ? (
              <div className="mt-1 relative z-20">
                <Select
                  options={assignedOptions}
                  value={form.assignedToUserId ?? ""}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      assignedToUserId: v === "" ? null : v,
                    }))
                  }
                  triggerClassName="rounded-full"
                />
              </div>
            ) : (
              <p className="mt-1 text-sm py-2 text-slate-800">{lead.assignedToName ?? "—"}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
            {isAdmin ? (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-medium text-white hover:bg-[#ea6a0f] disabled:cursor-not-allowed disabled:opacity-60"
                aria-busy={saving}
              >
                {saving ? <ButtonSpinner /> : null}
                {saving ? "Saving..." : "Save lead"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void saveNotesSales()}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-medium text-white hover:bg-[#ea6a0f] disabled:cursor-not-allowed disabled:opacity-60"
                aria-busy={saving}
              >
                {saving ? <ButtonSpinner /> : null}
                {saving ? "Saving..." : "Save notes"}
              </button>
            )}
          </div>
        </form>
      </AdminPanel>

      <LeadQuoteBlock
        lead={lead}
        pdfLeadNotes={form.notes}
        preparedByName={user?.name}
        onLeadUpdated={setLead}
        sectionId="lead-quote"
      />
    </div>
  );
}
