"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Link2 } from "lucide-react";
import { AdminPageHeader, AdminPanel } from "../../components/admin/AdminUI";
import LeadQuoteBlock from "../../components/leads/LeadQuoteBlock";
import Select from "../../components/ui/Select";
import { useAuth } from "../../context/AuthContext";
import { fetchLead, fetchLeads, type LeadRecord } from "../../lib/api";
import { toastError } from "../../lib/toast";

type Area = "salesman" | "admin";

export default function QuotesPage({ area }: { area: Area }) {
  const { user } = useAuth();
  const base = area === "admin" ? "" : "/salesman";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const leadIdParam = searchParams.get("leadId");

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<LeadRecord | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const replaceLeadQuery = useCallback(
    (id: number | null) => {
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      );
      const current = params.get("leadId");
      const next = id == null ? null : String(id);
      if (current === next || (current == null && next == null)) return;
      if (next == null) params.delete("leadId");
      else params.set("leadId", next);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const rows = await fetchLeads();
      setLeads(rows);
    } catch {
      toastError("Could not load leads.");
      setLeads([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const initialFromQuery = useMemo(() => {
    const n = leadIdParam ? Number(leadIdParam) : NaN;
    return Number.isFinite(n) && n >= 1 ? n : null;
  }, [leadIdParam]);

  const leadPickerOptions = useMemo(
    () => [
      { value: "", label: "— Select a lead —" },
      ...leads.map((l) => ({
        value: String(l.id),
        label: `#${l.id} · ${l.name} (${l.location})`,
      })),
    ],
    [leads],
  );

  useEffect(() => {
    if (initialFromQuery != null) {
      setSelectedId(initialFromQuery);
    }
  }, [initialFromQuery]);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDetail(true);
      try {
        const l = await fetchLead(selectedId);
        if (!cancelled) {
          setDetail(l);
          replaceLeadQuery(selectedId);
        }
      } catch {
        if (!cancelled) {
          setDetail(null);
          toastError("Could not load that lead.");
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, replaceLeadQuery]);

  function pickLead(id: number) {
    setSelectedId(id);
  }

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      <AdminPageHeader
        title="Quotes"
        subtitle="Build energymart.pk-style quotations, save to the lead, and download PDF — same workflow as the CRM reference project."
      />

      <div className="flex flex-col gap-6">
        <AdminPanel className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#F97316]" />
            Select lead
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Choose a lead to edit its quote. All your accessible leads are
            listed below.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">Lead</label>
            <div className="relative z-20">
              <Select
                options={leadPickerOptions}
                value={selectedId != null ? String(selectedId) : ""}
                onChange={(v) => {
                  if (v === "") {
                    setSelectedId(null);
                    replaceLeadQuery(null);
                  } else {
                    setSelectedId(Number(v));
                  }
                }}
                placeholder="— Select a lead —"
                triggerClassName="rounded-full"
              />
            </div>
          </div>

          {loadingList ? (
            <p className="text-sm text-slate-500 mt-4">Loading leads…</p>
          ) : (
            <ul className="mt-4 space-y-2 max-h-72 overflow-y-auto border border-gray-100 rounded-lg p-2">
              {leads.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => pickLead(l.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedId === l.id
                        ? "bg-[#F97316]/15 text-slate-900 font-medium"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="font-mono text-xs text-slate-500">
                      #{l.id}
                    </span>{" "}
                    {l.name}
                  </button>
                </li>
              ))}
              {leads.length === 0 ? (
                <li className="text-sm text-slate-500 px-2 py-4 text-center">
                  No leads yet.
                </li>
              ) : null}
            </ul>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5" />
              Full lead record
            </p>
            {selectedId ? (
              <Link
                href={`${base}/leads/${selectedId}#quote`}
                className="text-sm text-[#F97316] font-medium hover:underline"
              >
                Open lead #{selectedId} (details + quote)
              </Link>
            ) : (
              <span className="text-sm text-slate-400">
                Select a lead first
              </span>
            )}
          </div>
        </AdminPanel>

        <div className="min-h-[320px]">
          {loadingDetail && selectedId != null ? (
            <AdminPanel className="p-8 text-center text-slate-500">
              Loading quote…
            </AdminPanel>
          ) : detail ? (
            <LeadQuoteBlock
              lead={detail}
              pdfLeadNotes={detail.notes}
              preparedByName={user?.name}
              onLeadUpdated={(updated) => {
                setDetail(updated);
                setLeads((prev) =>
                  prev.map((x) => (x.id === updated.id ? updated : x)),
                );
              }}
              sectionId="lead-quote"
            />
          ) : (
            <AdminPanel className="p-8 text-center text-slate-500">
              Select a lead above to build or edit a quotation and download the
              PDF.
            </AdminPanel>
          )}
        </div>
      </div>
    </div>
  );
}
