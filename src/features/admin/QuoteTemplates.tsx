"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit, Plus, Search, Trash2 } from "lucide-react";
import {
  AdminPageHeader,
  AdminPanel,
  AdminTablePagination,
  AdminTableShell,
} from "../../components/admin/AdminUI";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { ButtonSpinner } from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useAdminTablePagination } from "../../hooks/useAdminTablePagination";
import { ApiError, type QuoteTemplate } from "../../lib/api";
import { toastError, toastSuccess } from "../../lib/toast";

type FormState = {
  category: string;
  title: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

function emptyForm(): FormState {
  return {
    category: "",
    title: "",
    description: "",
    sortOrder: "0",
    isActive: true,
  };
}

export default function AdminQuoteTemplates() {
  const [rows, setRows] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<QuoteTemplate | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const { fetchQuoteTemplatesAdmin } = await import("../../lib/api");
      const data = await fetchQuoteTemplatesAdmin();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not load quote templates.";
      setLoadError(msg);
      toastError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.category, r.title, r.description].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [rows, searchTerm]);

  const {
    page,
    setPage,
    pageItems,
    totalPages,
    startItem,
    endItem,
    totalItems,
  } = useAdminTablePagination(filtered, searchTerm);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (row: QuoteTemplate) => {
    setEditing(row);
    setForm({
      category: row.category,
      title: row.title,
      description: row.description ?? "",
      sortOrder: String(row.sortOrder ?? 0),
      isActive: row.isActive !== false,
    });
    setShowModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { createQuoteTemplate, updateQuoteTemplate } = await import("../../lib/api");
      const payload = {
        category: form.category.trim(),
        title: form.title.trim(),
        description: form.description,
        sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
        isActive: form.isActive,
      };
      if (editing) {
        await updateQuoteTemplate(editing.id, payload);
        toastSuccess("Quote template updated");
      } else {
        await createQuoteTemplate(payload);
        toastSuccess("Quote template created");
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm());
      void load();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not save quote template.";
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (pendingDeleteId == null) return;
    setDeleteBusy(true);
    try {
      const { deleteQuoteTemplate } = await import("../../lib/api");
      await deleteQuoteTemplate(pendingDeleteId);
      toastSuccess("Quote template deleted");
      setPendingDeleteId(null);
      void load();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not delete quote template.";
      toastError(msg);
    } finally {
      setDeleteBusy(false);
    }
  };

  const pendingDeleteName =
    pendingDeleteId != null ? rows.find((r) => r.id === pendingDeleteId)?.category : undefined;

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <AdminPageHeader
        title="Quote Templates"
        subtitle="Manage the default quote rows, PDF titles, and PDF descriptions."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#FF7A00] px-4 text-sm font-bold text-white hover:bg-[#e86e00]"
          >
            <Plus className="h-5 w-5" />
            <span>Add Template</span>
          </button>
        }
      />

      {loadError ? (
        <AdminPanel className="border-rose-200 bg-rose-50/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-rose-800">{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-[10px] bg-[#0B2A4A] px-4 text-sm font-bold text-white hover:bg-[#0a2440]"
            >
              Retry
            </button>
          </div>
        </AdminPanel>
      ) : null}

      <AdminPanel className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search quote templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 w-full rounded-[10px] border border-gray-200 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
          />
        </div>
      </AdminPanel>

      <AdminTableShell>
        <div className="admin-table-scroll min-w-0 touch-pan-x overflow-x-auto overflow-y-visible">
          <table className="min-w-[920px] w-full">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Category
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Description
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Order
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[#FF7A00]" />
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                pageItems.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                      {row.category}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {row.title}
                    </td>
                    <td className="max-w-[420px] px-6 py-4 text-sm text-gray-700">
                      <p className="line-clamp-2 whitespace-pre-wrap">{row.description || "—"}</p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {row.sortOrder ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.isActive !== false
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {row.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded-lg p-2 text-[#FF7A00] transition-colors hover:bg-[#FF7A00]/10"
                          aria-label="Edit quote template"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(row.id)}
                          disabled={deleteBusy}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Delete quote template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No quote templates found
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

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">
                {editing ? "Edit Quote Template" : "Add Quote Template"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (!saving) setShowModal(false);
                }}
                disabled={saving}
                className="rounded-lg px-2 py-1 text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={submit} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  required
                />
                <Input
                  label="Sort order"
                  type="number"
                  step="1"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
              <Input
                label="Title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={5}
                  className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
                />
              </div>
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-[#FF7A00] focus:ring-[#FF7A00]"
                />
                Active in quote generator
              </label>
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#FF7A00] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#e86e00] disabled:cursor-not-allowed disabled:opacity-70"
                  aria-busy={saving}
                >
                  {saving ? <ButtonSpinner /> : null}
                  {saving ? "Saving..." : editing ? "Update template" : "Add template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        onClose={() => {
          if (!deleteBusy) setPendingDeleteId(null);
        }}
        onConfirm={() => void executeDelete()}
        title="Delete quote template?"
        message={
          pendingDeleteName != null
            ? `Delete "${pendingDeleteName}"? This cannot be undone.`
            : "This cannot be undone."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        confirmLoading={deleteBusy}
      />
    </div>
  );
}
