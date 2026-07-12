"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, ImagePlus, Trash2, Pencil, Plus, Upload, X } from "lucide-react";
import {
  AdminPageHeader,
  AdminPanel,
  AdminTableShell,
} from "../../components/admin/AdminUI";
import {
  createAdminBlog,
  deleteAdminBlog,
  fetchAdminBlogs,
  invalidateAdminBootstrapCache,
  updateAdminBlog,
  type BlogPost,
} from "../../lib/api";
import { toastError, toastSuccess } from "../../lib/toast";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { ButtonSpinner } from "../../components/ui/Button";
import DatePickerField from "../../components/ui/DatePickerField";
import { BlogBodyEditor } from "../../components/admin/BlogBodyEditor";

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(s: string): string | undefined {
  if (!s.trim()) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

const emptyForm = {
  title: "",
  tag: "",
  imageUrl: "",
  excerpt: "",
  body: "",
  isPublished: true,
  publishedAt: "",
};

const MAX_COVER_IMAGE_BYTES = 2 * 1024 * 1024;

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function AdminBlogs() {
  const [rows, setRows] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminBlogs();
      setRows(data);
    } catch {
      toastError("Could not load blogs.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setEditingId(null);
    setCoverUploadError(null);
    setShowForm(true);
    setForm({
      ...emptyForm,
      publishedAt: toDatetimeLocal(new Date().toISOString()),
    });
  }

  function startEdit(b: BlogPost) {
    setCoverUploadError(null);
    setShowForm(true);
    setEditingId(b.id);
    setForm({
      title: b.title,
      tag: b.tag,
      imageUrl: b.image,
      excerpt: b.excerpt ?? "",
      body: b.body ?? "",
      isPublished: b.is_published,
      publishedAt: toDatetimeLocal(b.published_at),
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.imageUrl.trim()) {
      toastError("Please upload a cover image.");
      return;
    }
    setSaving(true);
    try {
      const publishedAt = fromDatetimeLocal(form.publishedAt);
      if (editingId != null) {
        const updated = await updateAdminBlog(editingId, {
          title: form.title.trim(),
          tag: form.tag.trim(),
          imageUrl: form.imageUrl.trim(),
          excerpt: form.excerpt.trim(),
          body: form.body.trim(),
          isPublished: form.isPublished,
          ...(publishedAt ? { publishedAt } : {}),
        });
        setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        toastSuccess("Blog updated");
      } else {
        const created = await createAdminBlog({
          title: form.title.trim(),
          tag: form.tag.trim(),
          imageUrl: form.imageUrl.trim(),
          excerpt: form.excerpt.trim(),
          body: form.body.trim(),
          isPublished: form.isPublished,
          ...(publishedAt ? { publishedAt } : {}),
        });
        setRows((prev) => [created, ...prev]);
        toastSuccess("Blog created");
      }
      invalidateAdminBootstrapCache();
      setEditingId(null);
      setShowForm(false);
      setCoverUploadError(null);
      setForm(emptyForm);
    } catch {
      toastError("Could not save blog.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCoverFiles(fileList: FileList | File[] | null) {
    setCoverUploadError(null);
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCoverUploadError("Only image files (JPEG, PNG, WebP, GIF) are allowed.");
      return;
    }
    if (file.size > MAX_COVER_IMAGE_BYTES) {
      setCoverUploadError(`“${file.name}” is too large (max 2 MB).`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      setForm((f) => ({ ...f, imageUrl: dataUrl }));
    } catch {
      setCoverUploadError(`Could not read “${file.name}”.`);
    }
  }

  const [pendingDeleteBlogId, setPendingDeleteBlogId] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function executeDeleteBlog() {
    if (pendingDeleteBlogId == null) return;
    const id = pendingDeleteBlogId;
    setDeleteBusy(true);
    try {
      await deleteAdminBlog(id);
      setRows((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setShowForm(false);
        setCoverUploadError(null);
        setForm(emptyForm);
      }
      invalidateAdminBootstrapCache();
      setPendingDeleteBlogId(null);
      toastSuccess("Blog deleted");
    } catch {
      toastError("Could not delete blog.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const pendingDeleteBlogTitle =
    pendingDeleteBlogId != null
      ? rows.find((r) => r.id === pendingDeleteBlogId)?.title
      : undefined;

  const hasCoverImage = Boolean(form.imageUrl.trim());

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      <AdminPageHeader
        title="Blog & news"
        subtitle="Posts appear on the homepage “Latest news” carousel and the public /news page."
        action={
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FF7A00] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#e86e00]"
          >
            <Plus className="h-4 w-4" />
            New post
          </button>
        }
      />

      {showForm && (
        <AdminPanel className="p-4 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            {editingId != null ? "Edit post" : "New post"}
          </h2>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-600">Title</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Tag / category</label>
              <input
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                placeholder="e.g. AE Power"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600" htmlFor="blog-published-at">
                Published
              </label>
              <div className="mt-1">
                <DatePickerField
                  id="blog-published-at"
                  withTime
                  value={form.publishedAt}
                  onChange={(next) => setForm((f) => ({ ...f, publishedAt: next }))}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-600">Cover image</label>
              <p className="mt-0.5 text-xs text-gray-500">
                Shown on the news carousel and article page. JPEG, PNG, WebP, or GIF — max 2 MB.
              </p>
              {!hasCoverImage ? (
                <p className="mt-1 text-[11px] leading-snug text-gray-400">
                  Demo mode embeds the file in the form (like product images). In production, upload to
                  storage and save the returned URL.
                </p>
              ) : null}
              <input
                ref={coverFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  await handleCoverFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {hasCoverImage ? (
                <div
                  className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await handleCoverFiles(e.dataTransfer.files);
                  }}
                >
                  <div className="relative aspect-[21/9] max-h-56 w-full bg-gray-100 sm:max-h-60">
                    <img
                      src={form.imageUrl}
                      alt="Cover preview"
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent pt-14 sm:pt-16" />
                    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3 sm:flex-row sm:items-end sm:justify-between">
                      <p className="text-xs font-medium text-white drop-shadow-sm">
                        Cover preview — drop a file here to replace
                      </p>
                      <div className="pointer-events-auto flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => coverFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                        >
                          <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Replace image
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, imageUrl: "" }));
                            setCoverUploadError(null);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/50 bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/25"
                        >
                          <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="mt-3 rounded-xl border-2 border-dashed border-gray-300 bg-white/80 px-4 py-8 text-center transition-colors hover:border-[#FF7A00]/45 hover:bg-[#FF7A00]/8"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await handleCoverFiles(e.dataTransfer.files);
                  }}
                >
                  <ImageIcon className="mx-auto h-10 w-10 text-gray-400" aria-hidden />
                  <p className="mt-2 text-sm font-medium text-slate-700">Drag & drop an image here</p>
                  <p className="mt-1 text-xs text-gray-500">or</p>
                  <button
                    type="button"
                    onClick={() => coverFileInputRef.current?.click()}
                    className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-[#FF7A00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e86e00]"
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    Choose image
                  </button>
                </div>
              )}
              {coverUploadError ? (
                <p className="mt-2 text-sm font-medium text-red-600" role="alert">
                  {coverUploadError}
                </p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-600">Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-600">Body (full article)</label>
              <div className="mt-1">
                <BlogBodyEditor
                  instanceKey={editingId != null ? `edit-${editingId}` : "create"}
                  value={form.body}
                  onChange={(html) => setForm((f) => ({ ...f, body: html }))}
                />
              </div>
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                />
                Published (visible on website)
              </label>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FF7A00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e86e00] disabled:cursor-not-allowed disabled:opacity-60"
                aria-busy={saving}
              >
                {saving ? <ButtonSpinner /> : null}
                {saving ? "Saving…" : editingId != null ? "Save changes" : "Create post"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (saving) return;
                  setEditingId(null);
                  setShowForm(false);
                  setCoverUploadError(null);
                  setForm(emptyForm);
                }}
                disabled={saving}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminPanel>
      )}

      <AdminTableShell>
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-base font-bold text-slate-900">All posts</h2>
          <p className="mt-1 text-sm text-gray-500">Newest first</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Tag</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[#FF7A00]" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No blog posts yet. Click “New post” to add one.
                  </td>
                </tr>
              ) : (
                rows.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">{b.title}</td>
                    <td className="px-4 py-3 text-gray-700">{b.tag || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{b.date}</td>
                    <td className="px-4 py-3">
                      {b.is_published ? (
                        <span className="text-emerald-700 font-medium">Live</span>
                      ) : (
                        <span className="text-slate-500">Draft</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEdit(b)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[#FF7A00] font-medium hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteBlogId(b.id)}
                        disabled={saving || deleteBusy}
                        className="ml-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-rose-600 font-medium hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminTableShell>

      <ConfirmDialog
        isOpen={pendingDeleteBlogId !== null}
        onClose={() => {
          if (!deleteBusy) setPendingDeleteBlogId(null);
        }}
        onConfirm={() => void executeDeleteBlog()}
        title="Delete blog post?"
        message={
          pendingDeleteBlogTitle != null
            ? `Delete “${pendingDeleteBlogTitle}”? This cannot be undone.`
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
