"use client";

import { useMemo, useState } from "react";
import ConfirmDialog from "../ui/ConfirmDialog";
import DropdownMenu from "../ui/DropdownMenu";
import Select from "../ui/Select";
import type { LeadRecord, SalesTeamUser } from "../../lib/api";

const STATUS = ["New", "Assigned", "In Progress", "Won", "Lost"] as const;

const STATUS_OPTIONS = STATUS.map((s) => ({ value: s, label: s }));

type Props = {
  leads: LeadRecord[];
  role: "admin" | "salesman";
  basePath: "/leads" | "/salesman/leads";
  salesTeam: SalesTeamUser[];
  query: string;
  onQueryChange: (q: string) => void;
  onPatch: (id: number, patch: Partial<LeadRecord>) => Promise<void>;
  onDeleteLead: (id: number) => void | Promise<void>;
};

export default function LeadsTable({
  leads,
  role,
  basePath,
  salesTeam,
  query,
  onQueryChange,
  onPatch,
  onDeleteLead,
}: Props) {
  const quotesBase = basePath.replace(/\/leads$/, "/quotes");

  const [pendingDeleteLeadId, setPendingDeleteLeadId] = useState<number | null>(null);
  const [patchBusyKey, setPatchBusyKey] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const filtered = leads.filter((l) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.location.toLowerCase().includes(q) ||
      l.productInterest.toLowerCase().includes(q) ||
      String(l.contact).includes(q)
    );
  });

  const assignedOptions = useMemo(
    () => [
      { value: "", label: "Unassigned" },
      ...salesTeam.map((s) => ({ value: s.id, label: s.name })),
    ],
    [salesTeam],
  );

  async function handlePatch(id: number, key: string, patch: Partial<LeadRecord>) {
    if (patchBusyKey) return;
    setPatchBusyKey(`${id}:${key}`);
    try {
      await onPatch(id, patch);
    } finally {
      setPatchBusyKey(null);
    }
  }

  async function confirmDeleteLead() {
    if (pendingDeleteLeadId == null || deleteBusy) return;
    const id = pendingDeleteLeadId;
    setDeleteBusy(true);
    try {
      await onDeleteLead(id);
      setPendingDeleteLeadId(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6">
        <input
          placeholder="Search leads..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316]"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-t border-gray-200 bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-3 font-medium whitespace-nowrap">ID</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium min-w-[140px]">Status</th>
              <th className="px-4 py-3 font-medium min-w-[160px]">Assigned</th>
              <th className="px-4 py-3 font-medium">Created by</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Updated</th>
              <th className="px-4 py-3 font-medium text-right w-[1%]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 hover:bg-slate-50/80">
                <td className="px-4 py-3 font-mono text-xs">{l.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{l.name}</td>
                <td className="px-4 py-3">{l.contact}</td>
                <td className="px-4 py-3">{l.location}</td>
                <td className="px-4 py-3">{l.productInterest}</td>
                <td className="relative z-20 min-w-[9.5rem] max-w-[11rem] overflow-visible px-4 py-3">
                  {role === "admin" ? (
                    <Select
                      size="sm"
                      dropdownPosition="above"
                      options={STATUS_OPTIONS}
                      value={STATUS.includes(l.status as (typeof STATUS)[number]) ? l.status : "New"}
                      disabled={patchBusyKey === `${l.id}:status`}
                      onChange={(v) =>
                        void handlePatch(l.id, "status", {
                          status: v as (typeof STATUS)[number],
                        })
                      }
                      triggerClassName="rounded-full"
                    />
                  ) : (
                    l.status
                  )}
                </td>
                <td className="relative z-20 min-w-[10rem] max-w-[14rem] overflow-visible px-4 py-3">
                  {role === "admin" ? (
                    <Select
                      size="sm"
                      dropdownPosition="above"
                      options={assignedOptions}
                      value={l.assignedToUserId ?? ""}
                      disabled={patchBusyKey === `${l.id}:assigned`}
                      onChange={(v) =>
                        void handlePatch(l.id, "assigned", {
                          assignedToUserId: v === "" ? null : v,
                        })
                      }
                      triggerClassName="rounded-full"
                    />
                  ) : l.assignedToName ? (
                    l.assignedToName
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">{l.createdByName ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                  {new Date(l.updatedAt).toLocaleDateString()}
                </td>
                <td className="relative z-20 px-4 py-3 text-right">
                  <div className="inline-flex justify-end">
                    <DropdownMenu
                      size="sm"
                      align="end"
                      dropdownPosition="above"
                      triggerClassName="rounded-full"
                      aria-label="Lead actions"
                      items={[
                        { id: "view", label: "View", to: `${basePath}/${l.id}` },
                        { id: "quote", label: "Quote", to: `${quotesBase}?leadId=${l.id}` },
                        ...(role === "admin"
                          ? [
                              {
                                id: "delete",
                                label: "Delete",
                                danger: true,
                                onSelect: () => setPendingDeleteLeadId(l.id),
                              },
                            ]
                          : []),
                        {
                          id: "edit",
                          label: "Edit",
                          to: `${basePath}/${l.id}#lead-details`,
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  No leads found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={pendingDeleteLeadId !== null}
        onClose={() => {
          if (!deleteBusy) setPendingDeleteLeadId(null);
        }}
        onConfirm={() => void confirmDeleteLead()}
        title="Delete lead?"
        message={
          pendingDeleteLeadId != null
            ? `Delete lead #${pendingDeleteLeadId}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        confirmLoading={deleteBusy}
      />
    </div>
  );
}
