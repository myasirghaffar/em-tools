"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "../../components/admin/AdminUI";
import LeadCreateForm from "../../components/leads/LeadCreateForm";
import LeadsTable from "../../components/leads/LeadsTable";
import LeadStatusChart from "../../components/sales/LeadStatusChart";
import { useAuth } from "../../context/AuthContext";
import {
  deleteLead,
  fetchLeads,
  fetchSalesTeam,
  updateLead,
  type LeadRecord,
  type SalesTeamUser,
} from "../../lib/api";
import { toastError, toastSuccess } from "../../lib/toast";

type BasePath = "/leads" | "/salesman/leads";

export default function LeadsListView({ basePath }: { basePath: BasePath }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [salesTeam, setSalesTeam] = useState<SalesTeamUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [l, team] = await Promise.all([
        fetchLeads(),
        isAdmin ? fetchSalesTeam() : Promise.resolve([] as SalesTeamUser[]),
      ]);
      setLeads(l);
      setSalesTeam(team);
    } catch {
      toastError("Could not load leads.");
      setLeads([]);
      setSalesTeam([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const onLeadCreated = useCallback((lead: LeadRecord) => {
    setLeads((prev) => {
      const i = prev.findIndex((x) => x.id === lead.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = lead;
        return next;
      }
      return [lead, ...prev];
    });
    setQuery("");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handlePatch(
    id: number,
    patch: Partial<{
      status: string;
      assignedToUserId: string | null;
    }>,
  ) {
    try {
      const updated = await updateLead(id, patch);
      setLeads((prev) => prev.map((x) => (x.id === id ? updated : x)));
    } catch {
      toastError("Could not update lead.");
    }
  }

  async function handleDeleteLead(id: number) {
    try {
      await deleteLead(id);
      setLeads((prev) => prev.filter((x) => x.id !== id));
      toastSuccess("Lead deleted.");
    } catch {
      toastError("Could not delete lead.");
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Leads"
        subtitle={
          isAdmin
            ? "Manage pipeline, assignment, and status."
            : "Create new leads, manage your pipeline, and build quotes."
        }
      />
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8 lg:items-stretch">
          <div className="flex min-h-0 flex-col">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Create lead</h2>
            <div className="max-w-xl lg:max-w-none">
              <LeadCreateForm onCreated={onLeadCreated} />
            </div>
          </div>
          <div className="flex h-full min-h-0 flex-col rounded-xl border border-[#F97316]/15 bg-gradient-to-b from-[#F97316]/[0.06] to-slate-50/80 p-4 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900 shrink-0">Pipeline overview</h2>
            <p className="mt-1 mb-4 shrink-0 text-xs text-slate-500">
              {isAdmin
                ? "Lead counts by status across your pipeline."
                : "Your leads — created by you or assigned to you."}
            </p>
            <div className="flex min-h-0 flex-1 flex-col">
              {loading ? (
                <div
                  className="min-h-[14rem] flex-1 rounded-lg bg-slate-100/90 animate-pulse"
                  aria-hidden
                />
              ) : (
                <LeadStatusChart
                  leads={leads}
                  scopeUserId={isAdmin ? undefined : user?.id}
                  fillHeight
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-slate-500">
          Loading leads…
        </div>
      ) : (
        <LeadsTable
          leads={leads}
          role={isAdmin ? "admin" : "salesman"}
          basePath={basePath}
          salesTeam={salesTeam}
          query={query}
          onQueryChange={setQuery}
          onPatch={handlePatch}
          onDeleteLead={handleDeleteLead}
        />
      )}
    </div>
  );
}
