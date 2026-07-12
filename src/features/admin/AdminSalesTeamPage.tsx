"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  AdminPageHeader,
  AdminPanel,
  AdminTablePagination,
  AdminTableShell,
  StatusPill,
} from "../../components/admin/AdminUI";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { ButtonSpinner } from "../../components/ui/Button";
import DropdownMenu from "../../components/ui/DropdownMenu";
import { useAdminTablePagination } from "../../hooks/useAdminTablePagination";
import {
  ApiError,
  createSalesTeamMember,
  fetchSalesTeam,
  patchSalesTeamMember,
  type SalesTeamUser,
} from "../../lib/api";
import { toastError, toastSuccess } from "../../lib/toast";

export default function AdminSalesTeamPage() {
  const [rows, setRows] = useState<SalesTeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [editing, setEditing] = useState<SalesTeamUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [pendingDeactivateUser, setPendingDeactivateUser] = useState<SalesTeamUser | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchSalesTeam();
      setRows(data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not load sales team.";
      setLoadError(msg);
      toastError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [rows, searchTerm]);

  const {
    page,
    setPage,
    pageItems,
    totalPages,
    totalItems,
    startItem,
    endItem,
  } = useAdminTablePagination(filtered, searchTerm);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setActionError("");
    try {
      await createSalesTeamMember({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setForm({ name: "", email: "", password: "" });
      await refresh();
      toastSuccess("Salesperson added");
    } catch (err) {
      const m = err instanceof ApiError ? err.message : "Could not add salesperson.";
      setActionError(m);
      toastError(m);
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setActionError("");
    try {
      await patchSalesTeamMember(editing.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        ...(form.password.trim() ? { password: form.password } : {}),
      });
      setEditing(null);
      setForm({ name: "", email: "", password: "" });
      await refresh();
      toastSuccess("Salesperson updated");
    } catch (err) {
      const m = err instanceof ApiError ? err.message : "Could not save changes.";
      setActionError(m);
      toastError(m);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(u: SalesTeamUser) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "" });
  }

  async function toggleActive(u: SalesTeamUser) {
    setToggleBusy(true);
    setActionError("");
    try {
      await patchSalesTeamMember(u.id, { isActive: !u.isActive });
      await refresh();
      toastSuccess(u.isActive ? "User deactivated" : "User activated");
    } catch (err) {
      const m = err instanceof ApiError ? err.message : "Could not update status.";
      setActionError(m);
      toastError(m);
    } finally {
      setToggleBusy(false);
    }
  }

  async function confirmDeactivate() {
    if (!pendingDeactivateUser) return;
    const u = pendingDeactivateUser;
    setPendingDeactivateUser(null);
    await toggleActive(u);
  }

  const pendingDeactivateName = pendingDeactivateUser?.name;

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <AdminPageHeader
        title="Sales team"
        subtitle="Create salesman accounts. They sign in at the same login page and manage their leads."
      />

      {loadError ? (
        <AdminPanel className="border-rose-200 bg-rose-50/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-rose-800">{loadError}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-[10px] bg-[#0B2A4A] px-4 text-sm font-bold text-white hover:bg-[#0a2440]"
            >
              Retry
            </button>
          </div>
        </AdminPanel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <AdminPanel className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search salespeople..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 w-full rounded-[10px] border border-gray-200 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
              />
            </div>
          </AdminPanel>

          <AdminTableShell>
            <div className="border-b border-gray-200 p-4 sm:p-6">
              <h2 className="text-base font-bold text-slate-900">Salespeople</h2>
              <p className="mt-1 text-sm text-gray-500">Manage accounts and access</p>
            </div>
            <div className="admin-table-scroll min-w-0 touch-pan-x overflow-x-auto overflow-y-visible">
              <table className="min-w-full w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Name
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Email
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Active
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[#FF7A00]" />
                      </td>
                    </tr>
                  ) : pageItems.length > 0 ? (
                    pageItems.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">
                          {u.name}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {u.email}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <StatusPill
                            label={u.isActive ? "Yes" : "No"}
                            variant={u.isActive ? "success" : "danger"}
                          />
                        </td>
                        <td className="relative z-20 whitespace-nowrap px-6 py-4 text-right">
                          <div className="inline-flex justify-end">
                            <DropdownMenu
                              size="sm"
                              align="end"
                              dropdownPosition="above"
                              triggerClassName="rounded-full"
                              aria-label={`Actions for ${u.name}`}
                              disabled={toggleBusy}
                              items={[
                                {
                                  id: "edit",
                                  label: "Edit",
                                  onSelect: () => startEdit(u),
                                },
                                ...(u.isActive
                                  ? [
                                      {
                                        id: "deactivate",
                                        label: "Deactivate",
                                        danger: true as const,
                                        onSelect: () => setPendingDeactivateUser(u),
                                      },
                                    ]
                                  : [
                                      {
                                        id: "activate",
                                        label: "Activate",
                                        onSelect: () => void toggleActive(u),
                                      },
                                    ]),
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        {rows.length === 0
                          ? "No salespeople yet. Add one on the right."
                          : "No salespeople match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <AdminTablePagination
              enabled={!loading}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              startItem={startItem}
              endItem={endItem}
              totalItems={totalItems}
            />
          </AdminTableShell>
        </div>

        <AdminPanel className="p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            {editing ? "Edit salesperson" : "Add salesperson"}
          </h2>
          {actionError ? (
            <div
              className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {actionError}
            </div>
          ) : null}
          <form className="space-y-3" onSubmit={editing ? onSaveEdit : onCreate}>
            <div>
              <label className="text-xs font-medium text-slate-600">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Email</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                Password {editing ? "(leave blank to keep)" : ""}
              </label>
              <input
                type="password"
                required={!editing}
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder={editing ? "••••••••" : "Min. 8 characters"}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#FF7A00] py-2 text-sm font-medium text-white hover:bg-[#e86e00] disabled:cursor-not-allowed disabled:opacity-60"
                aria-busy={saving}
              >
                {saving ? <ButtonSpinner /> : null}
                {saving ? "Saving…" : editing ? "Save" : "Add"}
              </button>
              {editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setForm({ name: "", email: "", password: "" });
                  }}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </AdminPanel>
      </div>

      <ConfirmDialog
        isOpen={pendingDeactivateUser !== null}
        onClose={() => {
          if (!toggleBusy) setPendingDeactivateUser(null);
        }}
        onConfirm={() => void confirmDeactivate()}
        title="Deactivate salesperson?"
        message={
          pendingDeactivateName != null
            ? `Deactivate “${pendingDeactivateName}”? They will no longer be able to sign in until reactivated.`
            : ""
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        variant="danger"
        confirmLoading={toggleBusy}
      />
    </div>
  );
}
