"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../lib/api";
import { toastError, toastSuccess } from "../../lib/toast";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  GripVertical,
  Upload,
  ImageIcon,
  FileUp,
  Loader2,
} from "lucide-react";
import Input from "../../components/ui/Input";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Select from "../../components/ui/Select";
import {
  AdminPageHeader,
  AdminPanel,
  AdminTablePagination,
  AdminTableShell,
  StatusPill,
} from "../../components/admin/AdminUI";
import { useScrollLock } from "../../hooks/useScrollLock";
import { useAdminTablePagination } from "../../hooks/useAdminTablePagination";

type SpecRow = { key: string; value: string };
type AttachmentRow = { title: string; href: string; fileName?: string };

type ProductFormState = {
  name: string;
  category: string;
  categoryMode: "pick" | "custom";
  customCategory: string;
  price: string;
  stock: string;
  description: string;
  longDescription: string;
  /** Data URLs (uploads) or existing http(s) URLs from the catalog */
  images: string[];
  brand: string;
  specRows: SpecRow[];
  attachmentRows: AttachmentRow[];
  highlightOptions: string[];
  status: "active" | "inactive";
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_HIGHLIGHT_OPTIONS = 4;

const ATTACHMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip";

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function emptyForm(): ProductFormState {
  return {
    name: "",
    category: "Solar Panels",
    categoryMode: "pick",
    customCategory: "",
    price: "",
    stock: "",
    description: "",
    longDescription: "",
    images: [],
    brand: "",
    specRows: [{ key: "", value: "" }],
    attachmentRows: [{ title: "", href: "" }],
    highlightOptions: [""],
    status: "active",
  };
}

function highlightsFromProduct(list: string[] | undefined): string[] {
  if (!Array.isArray(list) || list.length === 0) return [""];
  const labels = list
    .filter((o) => typeof o === "string" && o.trim().length > 0)
    .slice(0, MAX_HIGHLIGHT_OPTIONS);
  return labels.length > 0 ? labels : [""];
}

function specsFromProduct(
  specs: Record<string, unknown> | undefined,
): SpecRow[] {
  const entries = Object.entries(specs || {});
  if (entries.length === 0) return [{ key: "", value: "" }];
  return entries.map(([key, value]) => ({ key, value: String(value ?? "") }));
}

function attachmentsFromProduct(
  list: { title: string; href: string }[] | undefined,
): AttachmentRow[] {
  if (!Array.isArray(list) || list.length === 0)
    return [{ title: "", href: "" }];
  return list.map((a) => {
    const href = a.href ?? "";
    let fileName: string | undefined;
    if (href.startsWith("data:")) fileName = "Uploaded document";
    else if (href.startsWith("http://") || href.startsWith("https://"))
      fileName = "Web link";
    return { title: a.title ?? "", href, fileName };
  });
}

function buildPayload(form: ProductFormState) {
  const specifications: Record<string, string> = {};
  for (const row of form.specRows) {
    const k = row.key.trim();
    if (k) specifications[k] = row.value.trim();
  }

  const attachments = form.attachmentRows
    .filter((r) => r.title.trim() && r.href.trim() && r.href.trim() !== "#")
    .map((r) => ({
      title: r.title.trim(),
      href: r.href.trim(),
    }));

  const images = form.images.filter(Boolean);

  return {
    name: form.name.trim(),
    category:
      form.categoryMode === "custom"
        ? form.customCategory.trim()
        : form.category,
    price: parseFloat(form.price),
    stock: parseInt(form.stock, 10),
    description: form.description.trim(),
    longDescription: form.longDescription.trim() || undefined,
    brand: form.brand.trim() || undefined,
    specifications,
    attachments: attachments.length ? attachments : [],
    images: images.length ? images : ["/placeholder-product.jpg"],
    highlightOptions: form.highlightOptions
      .map((o) => o.trim())
      .filter(Boolean)
      .slice(0, MAX_HIGHLIGHT_OPTIONS),
    status: form.status,
  };
}

const CUSTOM_CATEGORY_VALUE = "__custom__";
const PRODUCT_STATUS_OPTIONS = [
  { value: "active", label: "Active (visible in store)" },
  { value: "inactive", label: "Inactive" },
];

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<
    { value: string; label: string }[]
  >([
    { value: "Solar Panels", label: "Solar Panels" },
    { value: CUSTOM_CATEGORY_VALUE, label: "Custom…" },
  ]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState<ProductFormState>(emptyForm);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDeleteProductId, setPendingDeleteProductId] = useState<number | null>(null);
  const [deleteProductBusy, setDeleteProductBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  useScrollLock(showModal);

  const loadProducts = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const {
        fetchAdminBootstrap,
        getAdminBootstrapCache,
        fetchProductsAdmin: apiFetchProducts,
        fetchProductCategoriesAdmin,
      } = await import("../../lib/api");
      const cached = getAdminBootstrapCache();
      if (cached?.products) {
        setProducts(Array.isArray(cached.products) ? cached.products : []);
        if (Array.isArray(cached.productCategories)) {
          const cats = cached.productCategories;
          setCategoryOptions(
            cats
              .slice()
              .sort(
                (a, b) =>
                  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
                  a.name.localeCompare(b.name),
              )
              .map((c) => ({ value: c.name, label: c.name }))
              .concat([{ value: CUSTOM_CATEGORY_VALUE, label: "Custom…" }]),
          );
        } else {
          void fetchProductCategoriesAdmin().then((cats) => {
            setCategoryOptions(
              (Array.isArray(cats) ? cats : [])
                .slice()
                .sort(
                  (a, b) =>
                    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
                    a.name.localeCompare(b.name),
                )
                .map((c) => ({ value: c.name, label: c.name }))
                .concat([{ value: CUSTOM_CATEGORY_VALUE, label: "Custom…" }]),
            );
          });
        }
        setLoading(false);
        void apiFetchProducts().then((fresh) => setProducts(Array.isArray(fresh) ? fresh : []));
        return;
      }
      const boot = await fetchAdminBootstrap();
      setProducts(Array.isArray(boot.products) ? boot.products : []);
      const cats = Array.isArray(boot.productCategories) ? boot.productCategories : [];
      setCategoryOptions(
        cats
          .slice()
          .sort(
            (a, b) =>
              (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
          )
          .map((c) => ({ value: c.name, label: c.name }))
          .concat([{ value: CUSTOM_CATEGORY_VALUE, label: "Custom…" }]),
      );
    } catch (err) {
      console.error("Fetch error:", err);
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not load products.";
      setLoadError(msg);
      toastError(msg);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitBusy) return;
    setSubmitBusy(true);
    try {
      const payload = buildPayload(formData);
      const { updateProduct, createProduct } = await import("../../lib/api");
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
      } else {
        await createProduct(payload);
      }

      setShowModal(false);
      setEditingProduct(null);
      setUploadError(null);
      setAttachmentError(null);
      setFormData(emptyForm());
      void loadProducts();
      toastSuccess(editingProduct ? "Product updated" : "Product created");
    } catch (err) {
      console.error("Error:", err);
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not save product.";
      toastError(msg);
    } finally {
      setSubmitBusy(false);
    }
  };

  const handleEdit = (product: any) => {
    const knownCategory = categoryOptions.some((o) => o.value === product.category);
    setEditingProduct(product);
    setUploadError(null);
    setAttachmentError(null);
    setFormData({
      name: product.name ?? "",
      category: knownCategory
        ? (product.category ?? categoryOptions[0]?.value ?? "Solar Panels")
        : (categoryOptions.find((o) => o.value !== CUSTOM_CATEGORY_VALUE)?.value ??
            "Solar Panels"),
      categoryMode: knownCategory ? "pick" : "custom",
      customCategory: knownCategory ? "" : String(product.category ?? ""),
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
      description: product.description ?? "",
      longDescription: product.longDescription ?? "",
      images: Array.isArray(product.images) ? [...product.images] : [],
      brand: product.brand ?? "",
      specRows: specsFromProduct(product.specifications),
      attachmentRows: attachmentsFromProduct(product.attachments),
      highlightOptions: highlightsFromProduct(product.highlightOptions),
      status: product.status === "inactive" ? "inactive" : "active",
    });
    setShowModal(true);
  };

  const executeDeleteProduct = async () => {
    if (pendingDeleteProductId == null) return;
    const id = pendingDeleteProductId;
    setDeleteProductBusy(true);
    try {
      const { deleteProduct } = await import("../../lib/api");
      await deleteProduct(id);
      void loadProducts();
      setPendingDeleteProductId(null);
      toastSuccess("Product deleted");
    } catch (err) {
      console.error("Error:", err);
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not delete product.";
      toastError(msg);
    } finally {
      setDeleteProductBusy(false);
    }
  };

  const addSpecRow = () =>
    setFormData((f) => ({
      ...f,
      specRows: [...f.specRows, { key: "", value: "" }],
    }));
  const removeSpecRow = (index: number) =>
    setFormData((f) => ({
      ...f,
      specRows:
        f.specRows.length > 1
          ? f.specRows.filter((_, i) => i !== index)
          : f.specRows,
    }));
  const updateSpecRow = (index: number, field: keyof SpecRow, value: string) =>
    setFormData((f) => ({
      ...f,
      specRows: f.specRows.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    }));

  const addHighlightOption = () =>
    setFormData((f) => {
      if (f.highlightOptions.length >= MAX_HIGHLIGHT_OPTIONS) return f;
      return { ...f, highlightOptions: [...f.highlightOptions, ""] };
    });
  const removeHighlightOption = (index: number) =>
    setFormData((f) => ({
      ...f,
      highlightOptions:
        f.highlightOptions.length > 1
          ? f.highlightOptions.filter((_, i) => i !== index)
          : [""],
    }));
  const updateHighlightOption = (index: number, value: string) =>
    setFormData((f) => ({
      ...f,
      highlightOptions: f.highlightOptions.map((label, i) =>
        i === index ? value : label,
      ),
    }));

  const addAttachmentRow = () =>
    setFormData((f) => ({
      ...f,
      attachmentRows: [
        ...f.attachmentRows,
        { title: "", href: "", fileName: undefined },
      ],
    }));
  const removeAttachmentRow = (index: number) =>
    setFormData((f) => ({
      ...f,
      attachmentRows:
        f.attachmentRows.length > 1
          ? f.attachmentRows.filter((_, i) => i !== index)
          : f.attachmentRows,
    }));
  const updateAttachmentRow = (
    index: number,
    partial: Partial<AttachmentRow>,
  ) =>
    setFormData((f) => ({
      ...f,
      attachmentRows: f.attachmentRows.map((row, i) =>
        i === index ? { ...row, ...partial } : row,
      ),
    }));

  const handleAttachmentFile = async (
    index: number,
    fileList: FileList | null,
  ) => {
    const file = fileList?.[0];
    if (!file) return;
    setAttachmentError(null);
    const okMime =
      file.type === "application/pdf" ||
      file.type.startsWith("image/") ||
      file.type === "application/msword" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "application/vnd.ms-excel" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "text/plain" ||
      file.type === "application/zip";
    if (
      !okMime &&
      !/\.(pdf|doc|docx|xls|xlsx|txt|zip|png|jpe?g|webp)$/i.test(file.name)
    ) {
      setAttachmentError(
        "Unsupported file type. Use PDF, Word, Excel, text, ZIP, or common images.",
      );
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError(`“${file.name}” is too large (max 3 MB per file).`);
      return;
    }
    try {
      const href = await readFileAsDataURL(file);
      updateAttachmentRow(index, { href, fileName: file.name });
    } catch {
      setAttachmentError(`Could not read “${file.name}”.`);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        String(p?.name ?? "")
          .toLowerCase()
          .includes(q) ||
        String(p?.category ?? "")
          .toLowerCase()
          .includes(q),
    );
  }, [products, searchTerm]);

  const {
    page,
    setPage,
    pageItems,
    totalPages,
    startItem,
    endItem,
    totalItems,
  } = useAdminTablePagination(filteredProducts, searchTerm);

  const processImageFiles = async (fileList: FileList | File[] | null) => {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    setUploadError(null);
    const additions: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setUploadError("Only image files (JPEG, PNG, WebP, GIF) are allowed.");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setUploadError(`“${file.name}” is too large (max 2 MB per file).`);
        continue;
      }
      try {
        additions.push(await readFileAsDataURL(file));
      } catch {
        setUploadError(`Could not read “${file.name}”.`);
      }
    }
    if (additions.length) {
      setFormData((fd) => ({ ...fd, images: [...fd.images, ...additions] }));
    }
  };

  const removeImageAt = (index: number) =>
    setFormData((f) => ({
      ...f,
      images: f.images.filter((_, i) => i !== index),
    }));

  const moveImage = (from: number, to: number) => {
    setFormData((f) => {
      if (
        from < 0 ||
        from >= f.images.length ||
        to < 0 ||
        to >= f.images.length
      )
        return f;
      const next = [...f.images];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...f, images: next };
    });
  };

  const pendingDeleteProductName =
    pendingDeleteProductId != null
      ? products.find((p: { id: number }) => p.id === pendingDeleteProductId)?.name
      : undefined;

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <AdminPageHeader
        title="Products"
        subtitle="Manage catalog data shown on product pages (tabs, specs, attachments)"
        action={
          <button
            type="button"
            onClick={() => {
              setFormData(emptyForm());
              setEditingProduct(null);
              setUploadError(null);
              setAttachmentError(null);
              setShowModal(true);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#FF7A00] px-4 text-sm font-bold text-white hover:bg-[#e86e00]"
          >
            <Plus className="h-5 w-5" />
            <span>Add Product</span>
          </button>
        }
      />

      {loadError ? (
        <AdminPanel className="border-rose-200 bg-rose-50/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-rose-800">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadProducts()}
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
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 w-full rounded-[10px] border border-gray-200 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
          />
        </div>
      </AdminPanel>

      <AdminTableShell>
        <div className="admin-table-scroll min-w-0 touch-pan-x overflow-x-auto overflow-y-visible">
          <table className="min-w-full w-full">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Product
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Category
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Price
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Stock
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
              ) : filteredProducts.length > 0 ? (
                pageItems.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={
                            product.images?.[0] || "/placeholder-product.jpg"
                          }
                          alt={product.name}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                        <div>
                          <p className="whitespace-nowrap font-medium text-slate-900">
                            {product.name}
                          </p>
                          <p className="whitespace-nowrap text-sm text-gray-500">
                            {product.brand || "No brand"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {product.category}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[#FF7A00]">
                      Rs. {product.price?.toLocaleString() || 0}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {product.stock || 0}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusPill
                        label={product.status || "active"}
                        variant={
                          product.status === "active" ? "success" : "danger"
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(product)}
                          className="rounded-lg p-2 text-[#FF7A00] transition-colors hover:bg-[#FF7A00]/10"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteProductId(product.id)}
                          disabled={deleteProductBusy}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Delete product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No products found
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (submitBusy) return;
                  setUploadError(null);
                  setAttachmentError(null);
                  setShowModal(false);
                }}
                disabled={submitBusy}
                className="rounded-lg px-2 py-1 text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <FormSection title="Basics">
                <Input
                  label="Product name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Select
                    label="Category"
                    required
                    options={categoryOptions}
                    value={
                      formData.categoryMode === "custom"
                        ? CUSTOM_CATEGORY_VALUE
                        : formData.category
                    }
                    onChange={(category) => {
                      if (category === CUSTOM_CATEGORY_VALUE) {
                        setFormData((f) => ({
                          ...f,
                          categoryMode: "custom",
                          customCategory: f.customCategory || f.category || "",
                        }));
                      } else {
                        setFormData((f) => ({
                          ...f,
                          categoryMode: "pick",
                          category,
                        }));
                      }
                    }}
                  />
                  {formData.categoryMode === "custom" ? (
                    <Input
                      label="Custom category"
                      value={formData.customCategory}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, customCategory: e.target.value }))
                      }
                      required
                    />
                  ) : (
                    <Input
                      label="Brand"
                      value={formData.brand}
                      onChange={(e) =>
                        setFormData({ ...formData, brand: e.target.value })
                      }
                    />
                  )}
                </div>
                {formData.categoryMode === "custom" ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input
                      label="Brand"
                      value={formData.brand}
                      onChange={(e) =>
                        setFormData({ ...formData, brand: e.target.value })
                      }
                    />
                    <div />
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Input
                    label="Price (PKR)"
                    type="number"
                    min={0}
                    step="1"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    required
                  />
                  <Input
                    label="Stock quantity"
                    type="number"
                    min={0}
                    step="1"
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: e.target.value })
                    }
                    required
                  />
                  <Select
                    label="Status"
                    options={PRODUCT_STATUS_OPTIONS}
                    value={formData.status}
                    onChange={(status) =>
                      setFormData({
                        ...formData,
                        status: status as "active" | "inactive",
                      })
                    }
                  />
                </div>
              </FormSection>

              <FormSection title="Images">
                <p className="text-sm text-gray-600">
                  Upload photos from your device. The <strong>first</strong>{" "}
                  image is the main image in the shop and on the product page.
                  You can reorder or remove thumbnails below.
                </p>
                <p className="text-xs text-gray-500">
                  Images are stored as data in your browser demo store (max 2 MB
                  each). For production, wire this to cloud storage instead.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    await processImageFiles(e.target.files);
                    e.target.value = "";
                  }}
                />

                <div
                  className="rounded-xl border-2 border-dashed border-gray-300 bg-white/80 px-4 py-8 text-center transition-colors hover:border-[#FF7A00]/45 hover:bg-[#FF7A00]/8"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await processImageFiles(e.dataTransfer.files);
                  }}
                >
                  <ImageIcon
                    className="mx-auto h-10 w-10 text-gray-400"
                    aria-hidden
                  />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Drag & drop images here
                  </p>
                  <p className="mt-1 text-xs text-gray-500">or</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-[#FF7A00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e86e00]"
                  >
                    <Upload className="h-4 w-4" />
                    Choose images
                  </button>
                </div>

                {uploadError ? (
                  <p className="text-sm font-medium text-red-600" role="alert">
                    {uploadError}
                  </p>
                ) : null}

                {formData.images.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Gallery ({formData.images.length})
                    </p>
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {formData.images.map((src, index) => (
                        <li
                          key={`img-${index}`}
                          className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                        >
                          <div className="relative aspect-square bg-gray-100">
                            <img
                              src={src}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            {index === 0 ? (
                              <span className="absolute left-2 top-2 rounded-md bg-[#e86e00] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                Main
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-1 border-t border-gray-100 bg-gray-50/90 p-2">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveImage(index, index - 1)}
                              className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-800 ring-1 ring-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              disabled={index === formData.images.length - 1}
                              onClick={() => moveImage(index, index + 1)}
                              className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-800 ring-1 ring-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImageAt(index)}
                              className="rounded-lg bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No images yet — uploads appear here. Save without images to
                    use the placeholder.
                  </p>
                )}
              </FormSection>

              <FormSection title="Product highlights (product page)">
                <p className="text-xs text-gray-500">
                  Short badges shown under the price (e.g. Free Delivery, 2 Year
                  Warranty). Up to {MAX_HIGHLIGHT_OPTIONS} options. Empty rows are
                  ignored on save.
                </p>
                <div className="space-y-2">
                  {formData.highlightOptions.map((label, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        placeholder={`Option ${index + 1} (e.g. Free Delivery)`}
                        value={label}
                        onChange={(e) =>
                          updateHighlightOption(index, e.target.value)
                        }
                        maxLength={120}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
                      />
                      <button
                        type="button"
                        onClick={() => removeHighlightOption(index)}
                        disabled={submitBusy}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Remove highlight"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addHighlightOption}
                  disabled={
                    submitBusy ||
                    formData.highlightOptions.length >= MAX_HIGHLIGHT_OPTIONS
                  }
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#FF7A00] hover:text-[#c55a00] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add highlight
                </button>
              </FormSection>

              <FormSection title="Description (storefront tabs)">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Short description{" "}
                    <span className="text-gray-400">
                      (Description tab, first paragraph)
                    </span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full rounded-[10px] border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Long description{" "}
                    <span className="text-gray-400">
                      (optional second paragraph)
                    </span>
                  </label>
                  <textarea
                    value={formData.longDescription}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        longDescription: e.target.value,
                      })
                    }
                    rows={5}
                    placeholder="Extra detail for the product page…"
                    className="w-full rounded-[10px] border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
                  />
                </div>
              </FormSection>

              <FormSection title="Specifications (Specifications tab)">
                <p className="text-xs text-gray-500">
                  Label / value pairs (e.g. Power → 550W). Empty rows are
                  ignored on save.
                </p>
                <div className="space-y-2">
                  {formData.specRows.map((row, index) => (
                    <div key={index} className="flex flex-wrap items-end gap-2">
                      <GripVertical
                        className="mb-2 h-4 w-4 shrink-0 text-gray-300"
                        aria-hidden
                      />
                      <input
                        placeholder="Label (e.g. Power)"
                        value={row.key}
                        onChange={(e) =>
                          updateSpecRow(index, "key", e.target.value)
                        }
                        className="min-w-[8rem] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
                      />
                      <input
                        placeholder="Value (e.g. 550W)"
                        value={row.value}
                        onChange={(e) =>
                          updateSpecRow(index, "value", e.target.value)
                        }
                        className="min-w-[8rem] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
                      />
                      <button
                        type="button"
                        onClick={() => removeSpecRow(index)}
                        className="mb-0.5 rounded-lg p-2 text-red-500 hover:bg-red-50"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addSpecRow}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#FF7A00] hover:text-[#c55a00]"
                >
                  <Plus className="h-4 w-4" />
                  Add specification row
                </button>
              </FormSection>

              <FormSection title="Attachments (Attachments tab)">
                <p className="text-sm text-gray-600">
                  Add a display title and upload a file (PDF, Word, Excel, text,
                  ZIP, or images). Rows without both a title and a file are
                  ignored when you save.
                </p>
                <p className="text-xs text-gray-500">
                  Files are embedded in the demo store (max 3 MB each). For
                  production, upload to storage and save the returned URL
                  instead.
                </p>
                {attachmentError ? (
                  <p className="text-sm font-medium text-red-600" role="alert">
                    {attachmentError}
                  </p>
                ) : null}
                <div className="space-y-3">
                  {formData.attachmentRows.map((row, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-stretch sm:gap-2"
                    >
                      <input
                        placeholder="Title (e.g. Technical datasheet)"
                        value={row.title}
                        onChange={(e) =>
                          updateAttachmentRow(index, { title: e.target.value })
                        }
                        className="box-border h-11 min-w-0 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35 sm:min-w-[10rem] sm:flex-1 sm:shrink-0"
                      />
                      <div className="flex min-h-11 min-w-0 flex-1 sm:min-w-[12rem] sm:flex-[2]">
                        <input
                          type="file"
                          id={`attachment-file-${index}`}
                          accept={ATTACHMENT_ACCEPT}
                          className="sr-only"
                          onChange={async (e) => {
                            await handleAttachmentFile(index, e.target.files);
                            e.target.value = "";
                          }}
                        />
                        <div className="flex h-11 min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/80 px-3 py-0">
                          {row.href && row.href !== "#" ? (
                            <>
                              <FileUp
                                className="h-4 w-4 shrink-0 text-[#FF7A00]"
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 truncate text-xs text-gray-700 sm:text-sm">
                                {row.fileName ||
                                  (row.href.startsWith("data:")
                                    ? "Uploaded document"
                                    : row.href.startsWith("http")
                                      ? "Web link"
                                      : "File")}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  document
                                    .getElementById(`attachment-file-${index}`)
                                    ?.click()
                                }
                                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-[#FF7A00] hover:bg-white/80 hover:text-[#c55a00]"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateAttachmentRow(index, {
                                    href: "",
                                    fileName: undefined,
                                  })
                                }
                                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-white/80 hover:text-gray-900"
                              >
                                Clear
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                document
                                  .getElementById(`attachment-file-${index}`)
                                  ?.click()
                              }
                              className="flex h-full min-h-0 w-full items-center justify-center gap-2 rounded-md bg-transparent px-3 text-sm font-semibold text-[#FF7A00] transition-colors hover:bg-[#FF7A00]/12"
                            >
                              <Upload className="h-4 w-4 shrink-0" />
                              Upload document
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachmentRow(index)}
                        className="box-border flex h-11 w-11 shrink-0 items-center justify-center self-stretch rounded-lg border border-gray-200 text-red-500 transition-colors hover:bg-red-50 sm:self-auto"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addAttachmentRow}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#FF7A00] hover:text-[#c55a00]"
                >
                  <Plus className="h-4 w-4" />
                  Add attachment row
                </button>
              </FormSection>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (submitBusy) return;
                    setUploadError(null);
                    setAttachmentError(null);
                    setShowModal(false);
                  }}
                  disabled={submitBusy}
                  className="rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#FF7A00] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#e86e00] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {editingProduct ? "Updating..." : "Adding..."}
                    </>
                  ) : editingProduct ? (
                    "Update product"
                  ) : (
                    "Add product"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingDeleteProductId !== null}
        onClose={() => {
          if (!deleteProductBusy) setPendingDeleteProductId(null);
        }}
        onConfirm={() => void executeDeleteProduct()}
        title="Delete product?"
        message={
          pendingDeleteProductName != null
            ? `Delete “${pendingDeleteProductName}”? This cannot be undone.`
            : "This cannot be undone."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        confirmLoading={deleteProductBusy}
      />
    </div>
  );
}
