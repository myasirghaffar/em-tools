"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminPanel } from "../admin/AdminUI";
import { ButtonSpinner } from "../ui/Button";
import DatePickerField from "../ui/DatePickerField";
import {
  fetchQuoteTemplates,
  updateLead,
  type LeadQuoteData,
  type LeadRecord,
  type QuoteTemplate,
  type QuoteLine,
} from "../../lib/api";
import { downloadLeadQuotePdf } from "../../lib/quotePdf";
import { toastError, toastSuccess } from "../../lib/toast";

/** Select value when the line uses a typed category not in the admin list */
const CUSTOM_CATALOG_CATEGORY = "__custom__";

/** Join title + detail for `description` JSON field. Preserves spaces and newlines while typing. */
function composeLineStorage(itemTitle: string, itemDescription: string): string {
  const t = itemTitle;
  const d = itemDescription;
  const hasT = t.trim().length > 0;
  const hasD = d.trim().length > 0;
  if (!hasT && !hasD) return "";
  if (!hasD) return t;
  if (!hasT) return d;
  return `${t}\n${d}`;
}

function emptyLine(): QuoteLine {
  return {
    description: "",
    quantity: 1,
    unitPrice: 0,
    productId: null,
    variantLabel: null,
    catalogCategoryKey: null,
    catalogCustomCategory: null,
    itemTitle: null,
    itemDescription: null,
    includeInPdf: true,
  };
}

function lineForTemplate(template: Pick<QuoteTemplate, "category" | "title" | "description">): QuoteLine {
  return {
    ...emptyLine(),
    catalogCategoryKey: template.category,
    catalogCustomCategory: null,
    itemTitle: template.title,
    itemDescription: template.description,
    description: composeLineStorage(template.title, template.description),
  };
}

/** If a saved row has no text yet, fill starter copy so the grid is not blank. */
function withTemplateDefaultsIfEmpty(
  line: QuoteLine,
  template: Pick<QuoteTemplate, "title" | "description">,
): QuoteLine {
  const t = String(line.itemTitle ?? "").trim();
  const d = String(line.itemDescription ?? "").trim();
  const legacy = String(line.description ?? "").trim();

  if (!t && !d && !legacy) {
    return {
      ...line,
      itemTitle: template.title,
      itemDescription: template.description,
      description: composeLineStorage(template.title, template.description),
    };
  }

  // Backfill preset description when title matches category default but detail was cleared.
  if (t && !d && template.description && t === template.title) {
    return {
      ...line,
      itemDescription: template.description,
      description: composeLineStorage(t, template.description),
    };
  }

  return line;
}

/** One row per known category, then any extra lines (custom / duplicates) preserved in order. */
function mergeTemplateGridLines(lines: QuoteLine[], templates: QuoteTemplate[]): QuoteLine[] {
  const normalized = templates.filter((t) => t.category.trim());
  const categories = normalized.map((t) => t.category);
  const byCat = new Map<string, QuoteLine>();
  const extras: QuoteLine[] = [];

  for (const l of lines) {
    let key: string | null = null;
    if (l.catalogCategoryKey && l.catalogCategoryKey !== CUSTOM_CATALOG_CATEGORY) {
      key = String(l.catalogCategoryKey).trim();
    } else if (l.catalogCategoryKey === CUSTOM_CATALOG_CATEGORY) {
      const c = String(l.catalogCustomCategory ?? "").trim();
      if (c && categories.includes(c)) key = c;
    }
    if (key && categories.includes(key)) {
      if (!byCat.has(key)) {
        byCat.set(key, {
          ...l,
          catalogCategoryKey: key,
          catalogCustomCategory: null,
        });
      } else {
        extras.push(l);
      }
    } else {
      extras.push(l);
    }
  }

  const ordered: QuoteLine[] = [];
  for (const template of normalized) {
    const row = byCat.get(template.category) ?? lineForTemplate(template);
    ordered.push(withTemplateDefaultsIfEmpty(row, template));
  }
  for (const x of extras) {
    ordered.push(x);
  }
  return ordered;
}

function emptyQuote(): LeadQuoteData {
  return {
    lines: [emptyLine()],
    taxPercent: 0,
    discountAmount: 0,
    notes: "",
    validUntil: "",
  };
}

function normalizeQuote(q: LeadQuoteData | null | undefined): LeadQuoteData {
  if (!q?.lines?.length) return emptyQuote();
  return {
    ...q,
    lines: q.lines.map((l) => {
      let itemTitle = l.itemTitle ?? null;
      let itemDescription = l.itemDescription ?? null;
      if (itemTitle == null && itemDescription == null) {
        const raw = String(l.description ?? "").trim();
        if (raw.includes("\n")) {
          const i = raw.indexOf("\n");
          itemTitle = raw.slice(0, i).trim() || null;
          itemDescription = raw.slice(i + 1).trim() || null;
        }
      }
      return {
        description: l.description ?? "",
        quantity: l.quantity || 1,
        unitPrice: l.unitPrice ?? 0,
        productId: l.productId ?? null,
        variantLabel: l.variantLabel ?? null,
        catalogCategoryKey: l.catalogCategoryKey ?? null,
        catalogCustomCategory: l.catalogCustomCategory ?? null,
        itemTitle,
        itemDescription,
        includeInPdf: l.includeInPdf !== false,
      };
    }),
  };
}

/**
 * Value for the title input. Must not `.trim()` — onChange passes this into sync while the other
 * field updates; trimming would strip spaces/newlines from the sibling on every keystroke.
 */
function lineTitleForForm(l: QuoteLine): string {
  if (l.itemTitle != null) return String(l.itemTitle);
  if (l.itemDescription != null && String(l.itemDescription).length > 0) return "";
  const raw = String(l.description ?? "");
  if (!raw.trim()) return "";
  const nl = raw.indexOf("\n");
  if (nl >= 0) return raw.slice(0, nl);
  return raw;
}

function lineDetailForForm(l: QuoteLine): string {
  if (l.itemDescription != null) return String(l.itemDescription);
  const raw = String(l.description ?? "");
  const nl = raw.indexOf("\n");
  if (nl >= 0) return raw.slice(nl + 1);
  return "";
}

export type LeadQuoteBlockProps = {
  lead: LeadRecord;
  pdfLeadNotes: string;
  preparedByName?: string;
  onLeadUpdated?: (lead: LeadRecord) => void;
  sectionId?: string;
};

export default function LeadQuoteBlock({
  lead,
  pdfLeadNotes,
  preparedByName,
  onLeadUpdated,
  sectionId = "lead-quote",
}: LeadQuoteBlockProps) {
  const [quote, setQuote] = useState<LeadQuoteData>(() => normalizeQuote(lead.quoteData));
  const [saving, setSaving] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [quoteTemplates, setQuoteTemplates] = useState<QuoteTemplate[]>([]);
  const leadSyncKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTemplateLoading(true);
      try {
        const rows = await fetchQuoteTemplates();
        if (!cancelled) setQuoteTemplates(rows.filter((r) => r.isActive !== false));
      } catch {
        if (!cancelled) setQuoteTemplates([]);
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeQuoteTemplates = useMemo(
    () => quoteTemplates.filter((t) => t.category.trim() && t.title.trim()),
    [quoteTemplates],
  );

  useEffect(() => {
    const leadSyncKey = `${lead.id}:${lead.updatedAt}`;
    if (activeQuoteTemplates.length === 0) {
      leadSyncKeyRef.current = leadSyncKey;
      setQuote(normalizeQuote(lead.quoteData));
      return;
    }
    setQuote((prev) => {
      const base = normalizeQuote(lead.quoteData);
      const leadChanged = leadSyncKeyRef.current !== leadSyncKey;
      leadSyncKeyRef.current = leadSyncKey;
      const linesSource = leadChanged ? base.lines : prev.lines;
      return {
        ...(leadChanged ? base : prev),
        lines: mergeTemplateGridLines(linesSource, activeQuoteTemplates),
      };
    });
  }, [lead.id, lead.updatedAt, lead.quoteData, activeQuoteTemplates]);

  function applyCatalogCustomCategory(i: number, text: string) {
    setLine(i, {
      catalogCategoryKey: CUSTOM_CATALOG_CATEGORY,
      catalogCustomCategory: text,
      productId: null,
      variantLabel: null,
    });
  }

  function setLine(i: number, patch: Partial<QuoteLine>) {
    setQuote((q) => {
      const lines = [...q.lines];
      lines[i] = { ...lines[i], ...patch };
      return { ...q, lines };
    });
  }

  function syncLinePdfFields(i: number, title: string, detail: string) {
    setLine(i, {
      itemTitle: title.length > 0 ? title : null,
      itemDescription: detail.length > 0 ? detail : null,
      description: composeLineStorage(title, detail),
    });
  }

  function addLine() {
    setQuote((q) => ({
      ...q,
      lines: [
        ...q.lines,
        {
          ...emptyLine(),
          catalogCategoryKey: CUSTOM_CATALOG_CATEGORY,
          catalogCustomCategory: "",
        },
      ],
    }));
  }

  const categoryRowCount = activeQuoteTemplates.length;

  function removeLine(i: number) {
    if (i < categoryRowCount) return;
    setQuote((q) => {
      if (q.lines.length <= 1) return q;
      return { ...q, lines: q.lines.filter((_, j) => j !== i) };
    });
  }

  function clearLine(i: number) {
    if (i < categoryRowCount && categoryRowCount > 0) {
      const template = activeQuoteTemplates[i];
      if (template) setLine(i, lineForTemplate(template));
      return;
    }
    setLine(i, {
      ...emptyLine(),
      catalogCategoryKey: CUSTOM_CATALOG_CATEGORY,
      catalogCustomCategory: "",
    });
  }

  function buildQuotePayload(): LeadQuoteData | null {
    const lines = quote.lines
      .map((l) => {
        const title = String(l.itemTitle ?? "").trim();
        const detail = String(l.itemDescription ?? "").trim();
        const composed = composeLineStorage(title, detail) || String(l.description ?? "").trim();
        return {
          description: composed,
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          productId: l.productId ?? null,
          variantLabel: l.variantLabel?.trim() || null,
          catalogCategoryKey: l.catalogCategoryKey ?? null,
          catalogCustomCategory: l.catalogCustomCategory?.trim() || null,
          itemTitle: title || null,
          itemDescription: detail || null,
          includeInPdf: l.includeInPdf !== false,
        };
      })
      .filter((l) => {
        const title = String(l.itemTitle ?? "").trim();
        const detail = String(l.itemDescription ?? "").trim();
        const desc = String(l.description ?? "").trim();
        const hasText =
          title.length > 0 || detail.length > 0 || desc.length > 0;
        const q = Number(l.quantity) || 0;
        const u = Number(l.unitPrice) || 0;
        return hasText && (q > 0 || u > 0);
      });
    if (lines.length === 0) return null;
    return {
      lines,
      taxPercent: Number(quote.taxPercent) || 0,
      discountAmount: Number(quote.discountAmount) || 0,
      notes: quote.notes?.trim() ?? "",
      validUntil: quote.validUntil?.trim() ?? "",
    };
  }

  async function saveQuoteOnly() {
    const payload = buildQuotePayload();
    if (!payload) {
      toastError("Add at least one row with title or description, plus quantity or unit price.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateLead(lead.id, { quoteData: payload });
      setQuote(normalizeQuote(updated.quoteData));
      onLeadUpdated?.(updated);
      toastSuccess("Quote saved");
    } catch {
      toastError("Could not save quote.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    const payload = buildQuotePayload();
    if (!payload) {
      toastError("Add line items to generate a PDF.");
      return;
    }
    if (!payload.lines.some((l) => l.includeInPdf !== false)) {
      toastError("Check at least one line (✓) to include on the PDF.");
      return;
    }
    try {
      await downloadLeadQuotePdf({
        lead: { ...lead, notes: pdfLeadNotes } as LeadRecord,
        quote: payload,
        preparedByName,
      });
      toastSuccess("PDF download started");
    } catch {
      toastError("Could not generate PDF (check network / logo assets).");
    }
  }

  return (
    <div id={sectionId} className="scroll-mt-24">
      <AdminPanel className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Quote & PDF</h2>
        <p className="text-sm text-slate-500 mb-4">
          Default rows come from Admin → Quote templates. Use the <strong>✓</strong> column to choose
          which lines appear on the PDF. Added lines are fully editable, and the footer subtotal counts
          only checked lines.
        </p>

        {templateLoading ? (
          <p className="text-sm text-slate-500 mb-4">Loading quote templates…</p>
        ) : activeQuoteTemplates.length === 0 ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
            No quote templates are active yet. Add templates in Admin → Quote templates, or enter
            custom lines below.
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-rose-200 bg-white shadow-sm">
          <table className="min-w-[680px] w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#9f1239] text-white">
                <th
                  className="border border-rose-200/80 px-1 py-2.5 text-center font-bold align-bottom w-11"
                  title="Include on PDF"
                >
                  <span className="sr-only">Include on PDF</span>
                  <span aria-hidden className="text-base leading-none">
                    ✓
                  </span>
                </th>
                <th className="border border-rose-200/80 px-2 py-2.5 text-left font-bold align-bottom w-[120px]">
                  Category
                </th>
                <th className="border border-rose-200/80 px-2 py-2.5 text-center font-bold align-bottom w-[72px]">
                  No
                </th>
                <th className="border border-rose-200/80 px-2 py-2.5 text-left font-bold align-bottom min-w-[240px]">
                  Details
                </th>
                <th className="border border-rose-200/80 px-2 py-2.5 text-right font-bold align-bottom w-[108px]">
                  Unit price
                </th>
                <th className="border border-rose-200/80 px-2 py-2.5 text-right font-bold align-bottom w-[108px]">
                  Total
                </th>
                <th className="border border-rose-200/80 px-2 py-2.5 text-right font-bold align-bottom w-[88px]">
                  {" "}
                </th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((line, i) => {
                const isLockedCategory = categoryRowCount > 0 && i < categoryRowCount;
                const categoryLabel = isLockedCategory
                  ? (activeQuoteTemplates[i]?.category ?? "")
                  : (line.catalogCustomCategory ?? line.catalogCategoryKey ?? "");
                const stripe = i % 2 === 1 ? "bg-rose-50/60" : "bg-white";
                const qn = Math.max(0, Number(line.quantity) || 0);
                const up = Math.max(0, Number(line.unitPrice) || 0);
                const lineTotal = qn * up;

                return (
                  <tr key={`${isLockedCategory ? categoryLabel : "row"}-${i}`} className={stripe}>
                    <td className="border border-rose-200 align-top px-1 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={line.includeInPdf !== false}
                        onChange={(e) => setLine(i, { includeInPdf: e.target.checked })}
                        className="h-4 w-4 rounded border-rose-300 text-[#9f1239] focus:ring-[#9f1239]"
                        title="Include this line on the PDF"
                        aria-label={`Include ${isLockedCategory ? categoryLabel : "this line"} on PDF`}
                      />
                    </td>
                    <td className="border border-rose-200 align-top px-2 py-1 text-slate-700">
                      {isLockedCategory ? (
                        <span className="font-semibold text-slate-800">{categoryLabel}</span>
                      ) : (
                        <input
                          value={categoryLabel === CUSTOM_CATALOG_CATEGORY ? "" : categoryLabel}
                          onChange={(e) => applyCatalogCustomCategory(i, e.target.value)}
                          placeholder="Category"
                          className="w-full px-2 py-1.5 border border-rose-200 rounded-md text-xs font-semibold"
                        />
                      )}
                    </td>
                    <td className="border border-rose-200 align-top px-1 py-1">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={qn === 0 ? "" : qn}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") setLine(i, { quantity: 0 });
                          else setLine(i, { quantity: Math.max(0, Number(v) || 0) });
                        }}
                        className="w-full min-w-0 px-1.5 py-1.5 border border-rose-200 rounded-md text-center text-sm"
                      />
                    </td>
                    <td className="border border-rose-200 align-top px-2 py-1">
                      <input
                        value={lineTitleForForm(line)}
                        onChange={(e) =>
                          syncLinePdfFields(i, e.target.value, lineDetailForForm(line))
                        }
                        placeholder="Title (bold on PDF)"
                        className="w-full px-2 py-1.5 border border-rose-200 rounded-md text-sm font-semibold mb-1.5"
                      />
                      <label className="sr-only" htmlFor={`quote-line-desc-${i}`}>
                        Subtitle and details for PDF (multi-line)
                      </label>
                      <textarea
                        id={`quote-line-desc-${i}`}
                        rows={2}
                        value={lineDetailForForm(line)}
                        onChange={(e) => syncLinePdfFields(i, lineTitleForForm(line), e.target.value)}
                        placeholder="Add details for PDF (optional)"
                        className="mt-1 w-full px-2 py-1.5 border border-rose-200 rounded-md text-sm resize-y min-h-[2.75rem] text-slate-700 leading-snug whitespace-pre-wrap"
                      />
                    </td>
                    <td className="border border-rose-200 align-top px-1 py-1">
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={up === 0 ? "" : up}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") setLine(i, { unitPrice: 0 });
                          else setLine(i, { unitPrice: Math.max(0, Number(v) || 0) });
                        }}
                        className="w-full min-w-0 px-1.5 py-1.5 border border-rose-200 rounded-md text-right text-sm tabular-nums"
                      />
                    </td>
                    <td className="border border-rose-200 align-top px-2 py-1 text-right font-semibold tabular-nums text-slate-900">
                      PKR {lineTotal.toLocaleString("en-PK")}
                    </td>
                    <td className="border border-rose-200 align-top px-1 py-1 text-right whitespace-nowrap">
                      {isLockedCategory ? (
                        <button
                          type="button"
                          onClick={() => clearLine(i)}
                          className="text-xs text-slate-600 hover:text-slate-900 hover:underline"
                        >
                          Clear
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="text-xs text-red-600 font-medium hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-rose-100/80 font-semibold text-slate-900">
                <td
                  colSpan={5}
                  className="border border-rose-200 px-2 py-2.5 text-right text-sm"
                >
                  Subtotal (lines on PDF)
                </td>
                <td className="border border-rose-200 px-2 py-2.5 text-right tabular-nums text-sm">
                  PKR{" "}
                  {quote.lines
                    .filter((l) => l.includeInPdf !== false)
                    .reduce((acc, l) => {
                      const q = Math.max(0, Number(l.quantity) || 0);
                      const u = Math.max(0, Number(l.unitPrice) || 0);
                      return acc + q * u;
                    }, 0)
                    .toLocaleString("en-PK")}
                </td>
                <td className="border border-rose-200" />
              </tr>
            </tfoot>
          </table>
        </div>
        <button
          type="button"
          onClick={() => addLine()}
          className="mt-3 text-sm text-[#F97316] font-semibold"
        >
          + Add another line
        </button>

        <div className="grid gap-4 md:grid-cols-3 mt-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Tax %</label>
            <input
              type="number"
              min={0}
              value={quote.taxPercent ?? 0}
              onChange={(e) => setQuote((q) => ({ ...q, taxPercent: Number(e.target.value) }))}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Discount (PKR)</label>
            <input
              type="number"
              min={0}
              value={quote.discountAmount ?? 0}
              onChange={(e) => setQuote((q) => ({ ...q, discountAmount: Number(e.target.value) }))}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="relative z-20">
            <label className="text-xs font-medium text-slate-600" htmlFor="quote-valid-until">
              Valid until
            </label>
            <div className="mt-1">
              <DatePickerField
                id="quote-valid-until"
                value={(quote.validUntil?.trim() ?? "").slice(0, 10)}
                onChange={(iso) => setQuote((q) => ({ ...q, validUntil: iso }))}
                placeholder="dd/mm/yyyy"
              />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-600">Quote notes (shown on PDF)</label>
          <textarea
            value={quote.notes ?? ""}
            onChange={(e) => setQuote((q) => ({ ...q, notes: e.target.value }))}
            rows={2}
            className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          <button
            type="button"
            onClick={() => void saveQuoteOnly()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#F97316] px-4 py-2 text-sm font-medium text-[#F97316] hover:bg-[#F97316]/10 disabled:cursor-not-allowed disabled:opacity-60"
            aria-busy={saving}
          >
            {saving ? <ButtonSpinner /> : null}
            {saving ? "Saving..." : "Save quote"}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            Download PDF
          </button>
        </div>
      </AdminPanel>
    </div>
  );
}
