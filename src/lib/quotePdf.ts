import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { LeadQuoteData, LeadRecord, QuoteLine } from "./api";

/** Brand orange ~#F37021 (matches legacy quotation PDFs) */
const ORANGE: [number, number, number] = [243, 112, 33];
const NAVY: [number, number, number] = [26, 43, 60];
const SLATE: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const BODY: [number, number, number] = [68, 68, 68];
const GREY_BG: [number, number, number] = [243, 244, 246];
const BORDER: [number, number, number] = [224, 227, 232];
/** Light rules for quote line-items table (jspdf-autotable; theme striped defaults to no borders). */
const QUOTE_TABLE_LINE_W = 0.12;
/** Min distance from page bottom (mm) so table / summary stay above footer rule + text. */
const QUOTE_PDF_FOOTER_RESERVE_MM = 20;
/** Top offset (mm) for inner-page header block — keep modest to save vertical space. */
const QUOTE_INNER_HEADER_TOP_MM = 12;

const COMPANY = {
  name: "ENERGYMART.PK",
  tagline: "ILLUMINATING YOUR WORLD",
  email: "info@energymart.pk",
  phone: "+92-301-4756516",
  address: "64-Lalazar Commercial, Raiwind Road Lahore",
  web: "www.energymart.pk",
  footerTag: "Professional Energy Solutions",
};

function publicAsset(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/";
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}${path.replace(/^\//, "")}`;
}

async function loadImageDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

function naturalSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("image load"));
    img.src = dataUrl;
  });
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMoneyDec(n: number): string {
  return new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDatePK(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function parseQuoteValidUntil(raw?: string): Date | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]) - 1;
    const d = Number(iso[3]);
    const dt = new Date(y, m, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(t);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function computeTotals(quote: LeadQuoteData): {
  subtotal: number;
  tax: number;
  discount: number;
  grand: number;
} {
  const subtotal = quote.lines.reduce(
    (s, l) => s + l.quantity * l.unitPrice,
    0,
  );
  const discount = Math.min(quote.discountAmount ?? 0, subtotal);
  const afterDiscount = Math.max(0, subtotal - discount);
  const taxPct = quote.taxPercent ?? 0;
  const tax = afterDiscount * (taxPct / 100);
  const grand = afterDiscount + tax;
  return { subtotal, tax, discount, grand };
}

type DocExt = jsPDF & { lastAutoTable?: { finalY: number } };

function quoteRefForLead(leadId: number): string {
  const y = new Date().getFullYear();
  return `EM-${y}-${String(leadId).padStart(6, "0")}`;
}

/** Normalize titles so PDF renders normal word spacing (strip ZW chars / odd spaces). */
function normalizeProductTitle(s: string): string {
  return s
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/\u3014/g, "[")
    .replace(/\u3015/g, "]")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bold PDF title: explicit `itemTitle`, else first line of legacy `description`. */
function pdfItemTitle(l: QuoteLine): string {
  const t = normalizeProductTitle(String(l.itemTitle ?? "").trim());
  if (t) return t;
  const raw = String(l.description ?? "").trim();
  if (!raw) return "";
  const nl = raw.indexOf("\n");
  const first = nl >= 0 ? raw.slice(0, nl) : raw;
  return normalizeProductTitle(first);
}

/** Normal-weight detail under title: `itemDescription`, variant, or legacy body after first line. */
function pdfItemDetail(l: QuoteLine): string {
  const explicit = String(l.itemDescription ?? "").trim();
  const v = l.variantLabel?.trim();
  const variantLine = v ? `(${normalizeProductTitle(v)})` : "";
  const raw = String(l.description ?? "").trim();
  let legacyBody = "";
  if (raw) {
    const nl = raw.indexOf("\n");
    if (nl >= 0) legacyBody = raw.slice(nl + 1).trim();
  }
  const body = explicit || legacyBody;
  const parts: string[] = [];
  if (body) parts.push(body);
  if (variantLine) parts.push(variantLine);
  return parts.join("\n").trim();
}

/** Use two-part layout (bold title + body text); otherwise one legacy block. */
function useSplitPdfLayout(l: QuoteLine): boolean {
  if (
    String(l.itemTitle ?? "").trim() ||
    String(l.itemDescription ?? "").trim()
  )
    return true;
  if (String(l.description ?? "").includes("\n")) return true;
  return false;
}

/** Legacy single-cell title (variant in parentheses on same line). */
function lineItemTitleLegacy(l: QuoteLine): string {
  const base = normalizeProductTitle(l.description || "");
  const v = l.variantLabel?.trim();
  if (!v) return base;
  return `${base} (${normalizeProductTitle(v)})`;
}

/** Faint centered watermark — draw before other page content. */
function drawWatermark(
  doc: jsPDF,
  wmDataUrl: string,
  pageW: number,
  pageH: number,
  wmW: number,
  wmH: number,
) {
  const tw = Math.min(pageW * 0.52, 115);
  const th = (wmH / wmW) * tw;
  const x = (pageW - tw) / 2;
  const y = (pageH - th) / 2;
  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: 0.07 }));
  doc.addImage(wmDataUrl, "PNG", x, y, tw, th);
  doc.restoreGraphicsState();
}

function drawFooterRule(
  doc: jsPDF,
  pageW: number,
  margin: number,
  pageH: number,
) {
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
}

function drawFooter(
  doc: jsPDF,
  pageNum: number,
  pageW: number,
  margin: number,
  pageH: number,
) {
  drawFooterRule(doc, pageW, margin, pageH);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  const line = `${COMPANY.name} - ${COMPANY.footerTag} | Page ${pageNum}`;
  doc.text(line, pageW / 2, pageH - 10, { align: "center" });
  doc.text(String(pageNum), pageW - margin, pageH - 10, { align: "right" });
  doc.setTextColor(...SLATE);
}

/**
 * Geometry for the repeated inner-page header (logo, company block, quotation card, rule).
 * `yBelowRule` must equal jspdf-autotable `margin.top` on continuation pages: autotable sets
 * `cursor.y = margin.top` after each page break, then runs willDrawPage (which draws this header),
 * then prints the orange table head — so margin.top must clear the drawn header.
 */
function measureInnerPageHeaderLayout(
  doc: jsPDF,
  logoWmm: number,
  logoHmm: number,
  pageW: number,
  margin: number,
  y0: number,
): { ruleY: number; yBelowRule: number } {
  const boxW = 72;
  const boxX = pageW - margin - boxW;
  const boxH = 26;
  const textLeft = margin + logoWmm + 3;
  const addrW = Math.max(28, boxX - textLeft - 4);
  const addrParts = doc.splitTextToSize(COMPANY.address, addrW);
  const addrLineMm = 3.1;
  const leftAddrBottom = y0 + 19.5 + Math.max(0, addrParts.length - 1) * addrLineMm + 2.8;
  const blockBottom = Math.max(y0 + logoHmm, y0 + boxH, leftAddrBottom);
  const ruleY = blockBottom + 2.5;
  return { ruleY, yBelowRule: ruleY + 5 };
}

/** Inner pages: logo + brand + quotation box + orange rule. Returns Y below rule. */
function drawInnerPageHeader(
  doc: jsPDF,
  logoDataUrl: string,
  logoWmm: number,
  logoHmm: number,
  pageW: number,
  margin: number,
  y0: number,
  quoteRef: string,
  issueStr: string,
  validStr: string,
): number {
  const boxW = 72;
  const boxX = pageW - margin - boxW;
  const boxH = 26;
  const { ruleY, yBelowRule } = measureInnerPageHeaderLayout(
    doc,
    logoWmm,
    logoHmm,
    pageW,
    margin,
    y0,
  );

  doc.addImage(logoDataUrl, "PNG", margin, y0, logoWmm, logoHmm);

  const textLeft = margin + logoWmm + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ORANGE);
  doc.text(COMPANY.name, textLeft, y0 + 4);
  doc.setFont("helvetica");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(COMPANY.tagline, textLeft, y0 + 8.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Email: ${COMPANY.email}`, textLeft, y0 + 12.5);
  doc.text(`Phone: ${COMPANY.phone}`, textLeft, y0 + 16);
  const addrW = Math.max(28, boxX - textLeft - 4);
  const addrParts = doc.splitTextToSize(COMPANY.address, addrW);
  doc.text(addrParts, textLeft, y0 + 19.5);

  doc.setFillColor(...GREY_BG);
  doc.roundedRect(boxX, y0, boxW, boxH, 1.5, 1.5, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(boxX, y0, 2.2, boxH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text("QUOTATION", boxX + 6, y0 + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`Quote #: ${quoteRef}`, boxX + 6, y0 + 12);
  doc.text(`Date: ${issueStr}`, boxX + 6, y0 + 16.5);
  doc.text(`Valid Until: ${validStr}`, boxX + 6, y0 + 21);

  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.9);
  doc.line(margin, ruleY, pageW - margin, ruleY);
  doc.setTextColor(...SLATE);
  return yBelowRule;
}

function drawOrangeLBorders(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  t: number,
) {
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, t, pageH, "F");
  doc.rect(0, pageH - t, pageW, t, "F");
}

export async function downloadLeadQuotePdf(opts: {
  lead: LeadRecord;
  quote: LeadQuoteData;
  preparedByName?: string;
  /** One entry per distinct catalog product (first feature image URL or null) — drives how many project image pages are added. */
  projectPhotoUrls?: (string | null)[] | null;
}): Promise<void> {
  const {
    lead,
    quote,
    preparedByName,
    projectPhotoUrls: _projectPhotoUrls,
  } = opts;
  const pdfLines = quote.lines.filter((l) => l.includeInPdf !== false);
  const quoteForPdf: LeadQuoteData = { ...quote, lines: pdfLines };
  const { subtotal, tax, discount, grand } = computeTotals(quoteForPdf);
  const quoteRef = quoteRefForLead(lead.id);

  const brandLogoUrl = await loadImageDataUrl(publicAsset("em-logo-only.png"));
  const logoDataUrl = brandLogoUrl;
  const wmDataUrl = brandLogoUrl;
  const logoNat = await naturalSize(brandLogoUrl);
  const wmNat = logoNat;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const cx = pageW / 2;

  const issueDate = new Date(lead.updatedAt);
  const issueStr = formatDatePK(issueDate);
  const validDt = parseQuoteValidUntil(quote.validUntil);
  const validStr = validDt ? formatDatePK(validDt) : "—";

  /** Keep logo shorter than the quotation card (~26mm) and aligned with the text block. */
  const logoWHeader = 22;
  const logoHHeader = (logoNat.h / logoNat.w) * logoWHeader;

  const phoneGuess = lead.contact.includes("@") ? "—" : lead.contact;

  function drawContactInfoBox(doc: jsPDF, y: number): number {
    const pad = 6;
    const bodyPt = 10;
    const titlePt = 10.5;
    const lineMm = 4.35;
    const title = "CONTACT INFORMATION";
    const intro = "For any queries regarding this quotation, please contact:";

    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyPt);
    let innerH = 9;
    const introLines = doc.splitTextToSize(intro, contentW - pad * 2 - 4);
    innerH += introLines.length * lineMm + 6;
    innerH += 3 * 6.5;
    const boxH = innerH + pad * 2;

    if (y + boxH > pageH - 22) {
      drawFooter(doc, doc.getNumberOfPages(), pageW, margin, pageH);
      doc.addPage();
      drawWatermark(doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
      y = drawInnerPageHeader(
        doc,
        logoDataUrl,
        logoWHeader,
        logoHHeader,
        pageW,
        margin,
        QUOTE_INNER_HEADER_TOP_MM,
        quoteRef,
        issueStr,
        validStr,
      );
    }

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(margin, y, contentW, boxH, 2, 2, "FD");
    let iy = y + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(titlePt);
    doc.setTextColor(...ORANGE);
    doc.text(title, margin + pad, iy);
    iy += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyPt);
    doc.setTextColor(...BODY);

    doc.text(introLines, margin + pad + 2, iy);
    iy += introLines.length * lineMm + 5;
    const rows: { label: string; value: string }[] = [
      { label: "Email:", value: COMPANY.email },
      { label: "Phone:", value: COMPANY.phone },
      { label: "Website:", value: COMPANY.web },
    ];
    for (const r of rows) {
      doc.setFont("helvetica", "bold");
      doc.text(r.label, margin + pad + 2, iy);
      const lw = doc.getTextWidth(r.label);
      doc.setFont("helvetica", "normal");
      doc.text(r.value, margin + pad + 2 + lw + 2, iy);
      iy += 6.5;
    }
    return y + boxH + 7;
  }

  // ----- Page 1: Cover (large type + vertical rhythm to fill page above footer) -----
  drawWatermark(doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
  drawOrangeLBorders(doc, pageW, pageH, 4);

  const coverFooterReserve = 22;
  const coverLogoW = 44;
  const coverLogoH = (logoNat.h / logoNat.w) * coverLogoW;
  let y = 26;
  doc.addImage(
    logoDataUrl,
    "PNG",
    cx - coverLogoW / 2,
    y,
    coverLogoW,
    coverLogoH,
  );
  y += coverLogoH + 20;

  doc.setCharSpace(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...ORANGE);
  doc.text("QUOTATION", cx, y, { align: "center" });
  y += 16;
  doc.setFontSize(17);
  doc.setTextColor(0, 0, 0);
  doc.text(COMPANY.name, cx, y, { align: "center" });
  y += 11;
  doc.setFont("helvetica");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(COMPANY.tagline, cx, y, { align: "center" });
  y += 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Prepared for:", cx, y, { align: "center" });
  y += 11;
  doc.setFontSize(18);
  doc.setTextColor(...ORANGE);
  doc.text(lead.name.trim() || "—", cx, y, { align: "center" });
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BODY);
  const contactStr = (lead.contact || "").trim() || "—";
  const addressStr = (lead.location || "").trim() || "—";
  const prepMaxW = contentW - 28;
  const contactLines = doc.splitTextToSize(`Contact: ${contactStr}`, prepMaxW);
  for (const line of contactLines) {
    doc.text(line, cx, y, { align: "center" });
    y += 4.4;
  }
  y += 1;
  const addressLines = doc.splitTextToSize(`Address: ${addressStr}`, prepMaxW);
  for (const line of addressLines) {
    doc.text(line, cx, y, { align: "center" });
    y += 4.4;
  }
  y += 8;
  /** Extra vertical space before quote metadata so the cover uses more of the page. */
  {
    const room = pageH - coverFooterReserve - y;
    if (room > 55) y += Math.min(36, room * 0.35);
    else if (room > 35) y += 18;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(`Date: ${issueStr}`, cx, y, { align: "center" });
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Quote #: ${quoteRef}`, cx, y, { align: "center" });

  drawFooter(doc, 1, pageW, margin, pageH);

  // ----- Page 2: Letter -----
  doc.addPage();
  drawWatermark(doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
  y = drawInnerPageHeader(
    doc,
    logoDataUrl,
    logoWHeader,
    logoHHeader,
    pageW,
    margin,
    QUOTE_INNER_HEADER_TOP_MM,
    quoteRef,
    issueStr,
    validStr,
  );

  doc.setCharSpace(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...SLATE);
  doc.text("SUBJECT: QUOTATION FOR ENERGY SOLUTIONS", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...BODY);
  doc.text(`Dear ${lead.name},`, margin, y);
  y += 10;

  const letterParas = [
    "We are pleased to offer our proposal based on your requirements for energy solutions.",
    "We assure you of providing the best solutions for your current project as well as any future assignments. As per your requirements, we are going to install a comprehensive energy system tailored to your needs.",
    "Please review the attached detailed quotation for complete project specifications and pricing.",
    "We are looking forward to helping you attain maximum savings on your electricity costs, whilst reducing your carbon footprint and contributing to a sustainable future.",
    "Please feel free to contact us if you need any further information or have questions regarding our proposal.",
  ];
  const bodyLineMm = 5.6;
  const paraGapMm = 9;
  for (const line of letterParas) {
    const lines = doc.splitTextToSize(line, contentW);
    doc.text(lines, margin, y);
    y += lines.length * bodyLineMm + paraGapMm;
  }
  y += 6;
  {
    const room = pageH - 22 - y;
    if (room > 40) y += Math.min(28, room * 0.35);
  }
  doc.text("Regards,", margin, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ORANGE);
  doc.setFontSize(11);
  doc.text(`Mubashir Zubair & The ${COMPANY.name} Team`, margin, y);
  y += 10;
  doc.setFontSize(10);
  doc.text(COMPANY.tagline, margin, y);
  doc.setTextColor(...BODY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    preparedByName
      ? `Prepared by: ${preparedByName}`
      : `Prepared by: Sales · ${COMPANY.name}`,
    margin,
    y + 8,
  );
  drawFooter(doc, 2, pageW, margin, pageH);

  // ----- Client + table -----
  doc.addPage();
  drawWatermark(doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
  y = drawInnerPageHeader(
    doc,
    logoDataUrl,
    logoWHeader,
    logoHHeader,
    pageW,
    margin,
    QUOTE_INNER_HEADER_TOP_MM,
    quoteRef,
    issueStr,
    validStr,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text("CLIENT INFORMATION", margin, y);
  y += 4;

  const colGap = 6;
  const colW = (contentW - 2 * colGap) / 3;
  const x1 = margin + 5;
  const x2 = x1 + colW + colGap;
  const x3 = x2 + colW + colGap;
  const addrLines = doc.splitTextToSize(lead.location || "—", colW - 2);
  const nameLines = doc.splitTextToSize(lead.name || "—", colW - 2);
  const phoneLines = doc.splitTextToSize(phoneGuess || "—", colW - 2);
  const clientBoxTopPad = 4;
  const clientBoxBottomPad = 4;
  const clientLabelAscentMm = 2.35;
  const labelToValueGap = 3.2;
  const clientValueLineMm = 3.35;
  const valueLineCount = Math.max(
    1,
    nameLines.length,
    phoneLines.length,
    addrLines.length,
  );
  const clientBoxH =
    clientBoxTopPad +
    clientLabelAscentMm +
    labelToValueGap +
    valueLineCount * clientValueLineMm +
    clientBoxBottomPad;

  doc.setFillColor(...GREY_BG);
  doc.roundedRect(margin, y, contentW, clientBoxH, 2, 2, "F");
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, contentW, clientBoxH, 2, 2, "S");

  let cy = y + clientBoxTopPad + clientLabelAscentMm;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...SLATE);
  doc.text("CLIENT NAME:", x1, cy);
  doc.text("PHONE NUMBER:", x2, cy);
  doc.text("ADDRESS:", x3, cy);
  cy += labelToValueGap;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(nameLines, x1, cy);
  doc.text(phoneLines, x2, cy);
  doc.text(addrLines, x3, cy);
  y += clientBoxH + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text("PRODUCTS & SERVICES", margin, y);
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.35);
  doc.line(margin, y + 2, pageW - margin, y + 2);
  y += 5;

  const lineToRow = (l: QuoteLine, idx: number) => {
    const item = String(idx + 1);
    return [
      item,
      " ",
      String(l.quantity),
      `PKR ${formatMoney(l.unitPrice)}`,
      `PKR ${formatMoney(l.quantity * l.unitPrice)}`,
    ];
  };
  const body = pdfLines.map((l, i) => lineToRow(l, i));

  const colItem = 11;
  const colQty = 14;
  const colUnit = 27;
  const colTot = 27;
  const colTitle = contentW - colItem - colQty - colUnit - colTot;

  /** Balanced vertical padding for quote line-item rows (mm). */
  const quoteTablePadV = 2.5;
  const quoteTablePadH = 1.5;
  const quoteTableTextAscent9 = 2.35;

  /** Where autotable resets `cursor.y` on each new page — must clear repeated `drawInnerPageHeader`. */
  const quoteTableContinuationTopMm = measureInnerPageHeaderLayout(
    doc,
    logoWHeader,
    logoHHeader,
    pageW,
    margin,
    QUOTE_INNER_HEADER_TOP_MM,
  ).yBelowRule;

  autoTable(doc, {
    startY: y,
    head: [["ITEM", "DETAILS", "QTY", "UNIT PRICE", "TOTAL"]],
    body,
    theme: "striped",
    showHead: "everyPage",
    headStyles: {
      fillColor: [...ORANGE],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 1.4,
      halign: "center",
      valign: "middle",
      lineWidth: QUOTE_TABLE_LINE_W,
      lineColor: [...BORDER],
    },
    bodyStyles: {
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: 0,
      cellPadding: {
        top: quoteTablePadV,
        right: quoteTablePadH,
        bottom: quoteTablePadV,
        left: quoteTablePadH,
      },
      lineWidth: QUOTE_TABLE_LINE_W,
      lineColor: [...BORDER],
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253],
      lineWidth: QUOTE_TABLE_LINE_W,
      lineColor: [...BORDER],
    },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: {
        top: quoteTablePadV,
        right: quoteTablePadH,
        bottom: quoteTablePadV,
        left: quoteTablePadH,
      },
      textColor: [0, 0, 0],
      valign: "middle",
      overflow: "linebreak",
      halign: "left",
      lineWidth: QUOTE_TABLE_LINE_W,
      lineColor: [...BORDER],
    },
    tableLineWidth: QUOTE_TABLE_LINE_W,
    tableLineColor: [...BORDER],
    didParseCell: (data) => {
      data.doc.setCharSpace(0);
      if (data.section !== "body") return;
      const col = data.column.index;
      const rowIdx = data.row.index;
      if (col === 1) {
        const line = pdfLines[rowIdx];
        if (line) {
          const doc = data.doc;
          // `didParseCell` runs while column widths are still being calculated — `cell.width` is 0 here.
          // Using it makes `splitTextToSize` wrap at a negative/tiny width → thousands of lines → huge rows.
          const padL = quoteTablePadH;
          const padR = quoteTablePadH;
          const padT = quoteTablePadV;
          const padB = quoteTablePadV;
          const innerW = Math.max(8, colTitle - padL - padR);
          const title =
            (pdfItemTitle(line) || lineItemTitleLegacy(line)).trim() || "—";
          const detail = useSplitPdfLayout(line)
            ? pdfItemDetail(line).trim()
            : "";
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          const tLines = doc.splitTextToSize(title, innerW);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          const dLines = detail ? doc.splitTextToSize(detail, innerW) : [];
          const lhTitle = 3;
          const lhDet = 2.75;
          const gap = detail ? 0.35 : 0;
          const h =
            padT +
            padB +
            quoteTableTextAscent9 +
            tLines.length * lhTitle +
            gap +
            dLines.length * lhDet;
          data.cell.styles.minCellHeight = h;
          data.row.height = h;
          data.cell.styles.cellPadding = {
            top: padT,
            right: padR,
            bottom: padB,
            left: padL,
          };
          data.cell.text = [" "];
        }
      } else {
        data.cell.styles.cellPadding = {
          top: quoteTablePadV,
          right: quoteTablePadH,
          bottom: quoteTablePadV,
          left: quoteTablePadH,
        };
        let s = data.cell.text as string | string[] | number | undefined;
        if (Array.isArray(s)) s = s.join("");
        data.cell.text = [
          String(s ?? "")
            .replace(/\u2212/g, "-")
            .replace(/[\u2018\u2019\u201C\u201D]/g, "'"),
        ];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 1) return;
      const line = pdfLines[data.row.index];
      if (!line) return;
      const doc = data.doc;
      const cell = data.cell;
      const padL = quoteTablePadH;
      const padT = quoteTablePadV;
      const padR = quoteTablePadH;
      const x = cell.x + padL;
      const w = cell.width - padL - padR;
      const bg: [number, number, number] =
        data.row.index % 2 === 1 ? [252, 252, 253] : [255, 255, 255];
      doc.setFillColor(...bg);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(QUOTE_TABLE_LINE_W);
      doc.rect(cell.x, cell.y, cell.width, cell.height, "FD");
      doc.setCharSpace(0);
      let yText = cell.y + padT + quoteTableTextAscent9;
      if (!useSplitPdfLayout(line)) {
        const single = lineItemTitleLegacy(line).trim() || "—";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        for (const tl of doc.splitTextToSize(single, w)) {
          doc.text(tl, x, yText);
          yText += 3;
        }
        return;
      }
      const title =
        (pdfItemTitle(line) || lineItemTitleLegacy(line)).trim() || "—";
      const detail = pdfItemDetail(line).trim();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      for (const tl of doc.splitTextToSize(title, w)) {
        doc.text(tl, x, yText);
        yText += 3;
      }
      if (detail) {
        yText += 0.25;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...BODY);
        for (const dl of doc.splitTextToSize(detail, w)) {
          doc.text(dl, x, yText);
          yText += 2.75;
        }
      }
    },
    columnStyles: {
      0: {
        cellWidth: colItem,
        halign: "center",
        fontStyle: "bold",
        valign: "middle",
      },
      1: {
        cellWidth: colTitle,
        halign: "left",
        fontStyle: "normal",
        valign: "top",
        overflow: "linebreak",
        cellPadding: {
          top: quoteTablePadV,
          right: quoteTablePadH,
          bottom: quoteTablePadV,
          left: quoteTablePadH,
        },
      },
      2: { cellWidth: colQty, halign: "center", valign: "middle" },
      3: { cellWidth: colUnit, halign: "right", valign: "middle" },
      4: {
        cellWidth: colTot,
        halign: "right",
        fontStyle: "bold",
        valign: "middle",
      },
    },
    margin: {
      left: margin,
      right: margin,
      top: quoteTableContinuationTopMm,
      bottom: QUOTE_PDF_FOOTER_RESERVE_MM,
    },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawWatermark(data.doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
        drawInnerPageHeader(
          data.doc,
          logoDataUrl,
          logoWHeader,
          logoHHeader,
          pageW,
          margin,
          QUOTE_INNER_HEADER_TOP_MM,
          quoteRef,
          issueStr,
          validStr,
        );
      }
    },
    didDrawPage: (data) => {
      const docPage = data.doc.internal.getCurrentPageInfo().pageNumber;
      drawFooter(data.doc, docPage, pageW, margin, pageH);
    },
  });

  const docExt = doc as DocExt;
  const tableFinalY = docExt.lastAutoTable?.finalY ?? y + 40;
  const summaryGapMm = 4;
  let ty = tableFinalY + summaryGapMm;

  const sumBoxW = 104;
  const sumBoxX = pageW - margin - sumBoxW;
  let sumBoxY0 = ty - 2;
  let sumH = 22;
  if (discount > 0) sumH += 5;
  if ((quote.taxPercent ?? 0) > 0) sumH += 5;
  sumH += 10;

  if (sumBoxY0 + sumH > pageH - QUOTE_PDF_FOOTER_RESERVE_MM) {
    doc.addPage();
    drawWatermark(doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
    const yBelowHeader = drawInnerPageHeader(
      doc,
      logoDataUrl,
      logoWHeader,
      logoHHeader,
      pageW,
      margin,
      QUOTE_INNER_HEADER_TOP_MM,
      quoteRef,
      issueStr,
      validStr,
    );
    sumBoxY0 = yBelowHeader + 4;
    ty = sumBoxY0 + 7;
    drawFooter(doc, doc.getNumberOfPages(), pageW, margin, pageH);
  }

  doc.setFillColor(...GREY_BG);
  doc.roundedRect(sumBoxX, sumBoxY0, sumBoxW, sumH, 2, 2, "F");
  doc.setDrawColor(...BORDER);
  doc.roundedRect(sumBoxX, sumBoxY0, sumBoxW, sumH, 2, 2, "S");

  ty = sumBoxY0 + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Subtotal:", sumBoxX + 4, ty);
  doc.setTextColor(...SLATE);
  doc.text(`PKR ${formatMoney(subtotal)}`, sumBoxX + sumBoxW - 4, ty, {
    align: "right",
  });
  ty += 5;
  if (discount > 0) {
    doc.setTextColor(...MUTED);
    doc.text("Discount:", sumBoxX + 4, ty);
    doc.setTextColor(...SLATE);
    doc.text(`-PKR ${formatMoney(discount)}`, sumBoxX + sumBoxW - 4, ty, {
      align: "right",
    });
    ty += 5;
  }
  if ((quote.taxPercent ?? 0) > 0) {
    doc.setTextColor(...MUTED);
    doc.text(`Tax (${quote.taxPercent}%):`, sumBoxX + 4, ty);
    doc.setTextColor(...SLATE);
    doc.text(`PKR ${formatMoneyDec(tax)}`, sumBoxX + sumBoxW - 4, ty, {
      align: "right",
    });
    ty += 5;
  }
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.35);
  doc.line(sumBoxX + 3, ty + 1, sumBoxX + sumBoxW - 3, ty + 1);
  ty += 6;
  doc.setFontSize(10);
  doc.setTextColor(...ORANGE);
  doc.text("Total:", sumBoxX + 4, ty);
  doc.setFontSize(11);
  doc.text(`PKR ${formatMoneyDec(grand)}`, sumBoxX + sumBoxW - 4, ty, {
    align: "right",
  });
  doc.setTextColor(...SLATE);

  // ----- Technical specifications -----
  doc.addPage();
  drawWatermark(doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
  y = drawInnerPageHeader(
    doc,
    logoDataUrl,
    logoWHeader,
    logoHHeader,
    pageW,
    margin,
    QUOTE_INNER_HEADER_TOP_MM,
    quoteRef,
    issueStr,
    validStr,
  );
  doc.setCharSpace(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...SLATE);
  doc.text("TECHNICAL SPECIFICATIONS", margin, y);
  y += 8;

  const specs = [
    "All equipment meets international safety standards and certifications",
    "Professional installation and commissioning included in the package",
    "Comprehensive warranty coverage with extended options available",
    "Post-installation support and maintenance services available",
    "Energy efficiency optimization and monitoring systems included",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  const specLineMm = 5.4;
  let innerH = 9;
  for (const s of specs) {
    const wrapped = doc.splitTextToSize(s, contentW - 16);
    innerH += wrapped.length * specLineMm + 1.5;
  }
  const specBoxH = innerH + 10;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, contentW, specBoxH, 2, 2, "F");
  doc.setDrawColor(...BORDER);
  doc.roundedRect(margin, y, contentW, specBoxH, 2, 2, "S");

  doc.setTextColor(...BODY);
  let sy = y + 9;
  for (const s of specs) {
    doc.text("•", margin + 4, sy);
    const wrapped = doc.splitTextToSize(s, contentW - 16);
    doc.text(wrapped, margin + 10, sy);
    sy += wrapped.length * specLineMm + 1.5;
  }
  y += specBoxH + 10;
  y = drawContactInfoBox(doc, y);
  drawFooter(doc, doc.getNumberOfPages(), pageW, margin, pageH);

  // ----- Terms -----
  doc.addPage();
  drawWatermark(doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
  y = drawInnerPageHeader(
    doc,
    logoDataUrl,
    logoWHeader,
    logoHHeader,
    pageW,
    margin,
    QUOTE_INNER_HEADER_TOP_MM,
    quoteRef,
    issueStr,
    validStr,
  );
  doc.setCharSpace(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text("TERMS & CONDITIONS", pageW / 2, y, { align: "center" });
  y += 16;

  const termsBlocks: {
    title: string;
    bullets: string[];
    bulletsPlain?: boolean;
  }[] = [
    {
      title: "1. PAYMENT TERMS",
      bullets: [
        "50% advance payment required upon order confirmation",
        "Remaining 50% payment due upon delivery and installation",
        "All payments to be made via bank transfer or certified cheque",
        "Payment terms are non-negotiable and must be strictly adhered to",
      ],
    },
    {
      title: "2. DELIVERY & INSTALLATION",
      bullets: [
        "Delivery timeline: 2-3 weeks after order confirmation and advance payment",
        "Professional installation included in the quoted price",
        "Site preparation requirements will be communicated in advance",
        "Installation will be completed by certified technicians",
      ],
    },
    {
      title: "3. WARRANTY & SUPPORT",
      bullets: [
        "1 year manufacturer warranty on all equipment",
        "Extended warranty options available at additional cost",
        "Warranty covers manufacturing defects and workmanship",
        "24/7 technical support available during warranty period",
      ],
    },
    {
      title: "4. QUOTATION VALIDITY",
      bullets: [
        validDt
          ? `This quotation is valid until ${validStr}.`
          : "Validity follows the date agreed in writing with your EnergyMart representative.",
        "Prices are subject to change without prior notice after this date.",
        "Early confirmation is recommended to secure current pricing.",
      ],
      bulletsPlain: true,
    },
  ];

  const pad = 6;
  const termsBodyPt = 10;
  const termsTitlePt = 10.5;
  const termsLineMm = 4.35;

  for (const block of termsBlocks) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(termsBodyPt);
    let innerH = 9;
    for (const b of block.bullets) {
      const w = doc.splitTextToSize(
        b,
        contentW - pad * 2 - (block.bulletsPlain ? 4 : 10),
      );
      innerH += w.length * termsLineMm + 1.2;
    }
    const boxH = innerH + pad * 2;
    if (y + boxH > pageH - 22) {
      drawFooter(doc, doc.getNumberOfPages(), pageW, margin, pageH);
      doc.addPage();
      drawWatermark(doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
      y = drawInnerPageHeader(
        doc,
        logoDataUrl,
        logoWHeader,
        logoHHeader,
        pageW,
        margin,
        QUOTE_INNER_HEADER_TOP_MM,
        quoteRef,
        issueStr,
        validStr,
      );
    }
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(margin, y, contentW, boxH, 2, 2, "FD");
    let iy = y + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(termsTitlePt);
    doc.setTextColor(...ORANGE);
    doc.text(block.title, margin + pad, iy);
    iy += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(termsBodyPt);
    doc.setTextColor(...BODY);
    for (const b of block.bullets) {
      if (block.bulletsPlain) {
        const wrapped = doc.splitTextToSize(b, contentW - pad * 2 - 4);
        doc.text(wrapped, margin + pad + 2, iy);
        iy += wrapped.length * termsLineMm + 0.8;
      } else {
        doc.text("•", margin + pad + 2, iy);
        const wrapped = doc.splitTextToSize(b, contentW - pad * 2 - 10);
        doc.text(wrapped, margin + pad + 7, iy);
        iy += wrapped.length * termsLineMm + 0.8;
      }
    }
    y += boxH + 7;
  }

  if (quote.notes?.trim()) {
    if (y > pageH - 40) {
      drawFooter(doc, doc.getNumberOfPages(), pageW, margin, pageH);
      doc.addPage();
      drawWatermark(doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
      y = drawInnerPageHeader(
        doc,
        logoDataUrl,
        logoWHeader,
        logoHHeader,
        pageW,
        margin,
        QUOTE_INNER_HEADER_TOP_MM,
        quoteRef,
        issueStr,
        validStr,
      );
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SLATE);
    doc.text("QUOTE NOTES", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BODY);
    doc.text(doc.splitTextToSize(quote.notes.trim(), contentW), margin, y);
    y += 20;
  }

  if (lead.notes?.trim()) {
    if (y > pageH - 40) {
      drawFooter(doc, doc.getNumberOfPages(), pageW, margin, pageH);
      doc.addPage();
      drawWatermark(doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
      y = drawInnerPageHeader(
        doc,
        logoDataUrl,
        logoWHeader,
        logoHHeader,
        pageW,
        margin,
        QUOTE_INNER_HEADER_TOP_MM,
        quoteRef,
        issueStr,
        validStr,
      );
    }
    doc.setFont("helvetica", "bold");
    doc.text("LEAD / SITE NOTES", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(lead.notes.trim(), contentW), margin, y);
  }

  drawFooter(doc, doc.getNumberOfPages(), pageW, margin, pageH);

  // ----- Thank you (spread vertically like cover) -----
  doc.addPage();
  drawWatermark(doc, wmDataUrl, pageW, pageH, wmNat.w, wmNat.h);
  drawOrangeLBorders(doc, pageW, pageH, 4);

  doc.setCharSpace(0);
  const tyFooterReserve = 22;
  const tyLogoW = 58;
  const tyLogoH = (logoNat.h / logoNat.w) * tyLogoW;
  y = 30;
  doc.addImage(logoDataUrl, "PNG", cx - tyLogoW / 2, y, tyLogoW, tyLogoH);
  y += tyLogoH + 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...ORANGE);
  doc.text("THANK YOU", cx, y, { align: "center" });
  y += 16;
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text("for choosing", cx, y, { align: "center" });
  y += 12;
  doc.setFontSize(15);
  doc.text(COMPANY.name, cx, y, { align: "center" });
  {
    const room = pageH - tyFooterReserve - y;
    if (room > 50) y += Math.min(32, room * 0.32);
    else if (room > 30) y += 18;
  }
  doc.setFontSize(13);
  doc.text("We look forward to", cx, y, { align: "center" });
  y += 12;
  doc.setFontSize(16);
  doc.setTextColor(...ORANGE);
  doc.text("serving your energy needs", cx, y, { align: "center" });
  y += 18;
  {
    const room = pageH - tyFooterReserve - y;
    if (room > 45) y += Math.min(28, room * 0.38);
  }
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(COMPANY.name, cx, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica");
  doc.setFontSize(10);
  doc.text(COMPANY.tagline, cx, y, { align: "center" });

  drawFooter(doc, doc.getNumberOfPages(), pageW, margin, pageH);

  doc.save(`EnergyMart-Quote-LEAD-${lead.id}.pdf`);
}
