"use client";

import { useEffect, useState } from "react";
import {
  FolderOpen,
  FileText,
  UserPlus,
  ClipboardList,
  MessageSquare,
  Mail,
  AlertCircle,
} from "lucide-react";
import { ApiError, type ToolsAnalytics } from "../../lib/api";
import { toastError } from "../../lib/toast";
import { AdminPageHeader, AdminPanel } from "../../components/admin/AdminUI";

function normalizeToolsAnalytics(raw: unknown): ToolsAnalytics {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const counts =
    r.leadStatusCounts && typeof r.leadStatusCounts === "object" && !Array.isArray(r.leadStatusCounts)
      ? (r.leadStatusCounts as Record<string, number>)
      : {};
  const leadStatusCounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    leadStatusCounts[k] = Number(v) || 0;
  }
  return {
    totalLeads: Number(r.totalLeads) || 0,
    totalQuotes: Number(r.totalQuotes) || 0,
    totalSalesTeam: Number(r.totalSalesTeam) || 0,
    totalQuoteTemplates: Number(r.totalQuoteTemplates) || 0,
    openConsultations: Number(r.openConsultations) || 0,
    openMessages: Number(r.openMessages) || 0,
    leadStatusCounts,
  };
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<ToolsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setAnalyticsError(null);
    try {
      const { fetchAdminBootstrap } = await import("../../lib/api");
      const boot = await fetchAdminBootstrap();
      setAnalytics(normalizeToolsAnalytics(boot.analytics));
    } catch (err) {
      console.error("Fetch error:", err);
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not load dashboard data.";
      setAnalyticsError(msg);
      toastError(msg);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF7A00]" />
      </div>
    );
  }

  const statusEntries = Object.entries(analytics?.leadStatusCounts ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const maxStatus = Math.max(1, ...statusEntries.map(([, n]) => n));

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      <AdminPageHeader
        title="Dashboard Overview"
        subtitle="Leads, quotes, and team activity across EnergyMart Tools."
      />

      {analyticsError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
            <span>{analyticsError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="mt-3 inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#0B2A4A] px-3 text-xs font-bold text-white hover:bg-[#0a2440] sm:mt-0"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
        <StatCard title="Total Leads" value={analytics?.totalLeads ?? 0} icon={FolderOpen} />
        <StatCard title="Quotes" value={analytics?.totalQuotes ?? 0} icon={FileText} />
        <StatCard title="Sales team" value={analytics?.totalSalesTeam ?? 0} icon={UserPlus} />
        <StatCard
          title="Quote templates"
          value={analytics?.totalQuoteTemplates ?? 0}
          icon={ClipboardList}
        />
        <StatCard
          title="Open consultations"
          value={analytics?.openConsultations ?? 0}
          icon={MessageSquare}
        />
        <StatCard title="Open messages" value={analytics?.openMessages ?? 0} icon={Mail} />
      </div>

      <AdminPanel className="overflow-hidden shadow-[0_12px_40px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/60">
        <div className="mb-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Leads by status</h2>
          <p className="mt-0.5 text-sm text-slate-500">Distribution across the pipeline.</p>
        </div>
        {statusEntries.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No lead status data yet.</p>
        ) : (
          <ul className="space-y-3">
            {statusEntries.map(([status, count]) => (
              <li key={status} className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-700 capitalize">{status}</span>
                  <span className="tabular-nums text-slate-500">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#FF7A00]"
                    style={{ width: `${Math.round((count / maxStatus) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="min-w-0 overflow-hidden bg-white rounded-2xl border border-gray-200/60 p-[17px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#FF7A00]/10">
          <Icon className="h-5 w-5 text-[#FF7A00]" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <h3 className="mt-2 text-sm font-medium text-gray-500">{title}</h3>
    </div>
  );
}
