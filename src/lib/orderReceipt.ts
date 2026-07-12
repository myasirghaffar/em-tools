/** Escape text for embedding in HTML receipts (prevents XSS from stored fields). */
export function escapeHtml(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatMoney(n: number | undefined | null): string {
  return `Rs. ${Number(n ?? 0).toLocaleString()}`;
}

const STORE_NAME = "energymart.pk";

export function buildOrderReceiptHtml(order: Record<string, unknown>): string {
  const orderId = String(order.id ?? "");
  const products = Array.isArray(order.products) ? (order.products as any[]) : [];
  const rows = products
    .map((item, i) => {
      const name = escapeHtml(item?.name ?? `Item ${i + 1}`);
      const qty = Number(item?.quantity) || 0;
      const unit = Number(item?.price) || 0;
      const line = unit * qty;
      return `<tr>
        <td>${name}</td>
        <td class="num">${qty}</td>
        <td class="num">${formatMoney(unit)}</td>
        <td class="num">${formatMoney(line)}</td>
      </tr>`;
    })
    .join("");

  const notes = String(order.notes ?? "").trim();
  const notesBlock = notes
    ? `<section class="section"><h2>Notes</h2><p class="notes">${escapeHtml(notes)}</p></section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Order #${escapeHtml(orderId)} — ${STORE_NAME}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 32px; color: #0f172a; background: #f8fafc; }
    .sheet { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; box-shadow: 0 25px 50px -12px rgba(15,23,42,0.15); }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #ea580c; margin-bottom: 8px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    .meta { color: #64748b; font-size: 14px; margin-bottom: 28px; }
    .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
    .badge { font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 999px; background: #f1f5f9; color: #475569; }
    .badge-accent { background: #fff7ed; color: #c2410c; }
    .section { margin-bottom: 28px; }
    .section h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin: 0 0 12px; }
    dl.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; margin: 0; }
    @media (max-width: 520px) { dl.grid { grid-template-columns: 1fr; } }
    dl.grid dt { font-size: 12px; color: #94a3b8; margin: 0; }
    dl.grid dd { font-size: 15px; font-weight: 600; margin: 4px 0 0; }
    .full { grid-column: 1 / -1; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 10px 12px; background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
    th.num, td.num { text-align: right; }
    td { padding: 14px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .total-row { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 18px 20px; background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-radius: 12px; border: 1px solid #fed7aa; }
    .total-row span:first-child { font-weight: 700; font-size: 15px; }
    .total-row span:last-child { font-size: 22px; font-weight: 800; color: #ea580c; }
    .notes { margin: 0; padding: 16px; background: #f8fafc; border-radius: 10px; color: #475569; font-size: 14px; line-height: 1.5; }
    footer { margin-top: 36px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border-radius: 0; padding: 24px; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="brand">${escapeHtml(STORE_NAME)}</div>
    <h1>Order receipt #${escapeHtml(orderId)}</h1>
    <p class="meta">Placed on ${escapeHtml(formatDate(String(order.created_at ?? "")))}</p>
    <div class="badges">
      <span class="badge badge-accent">Order: ${escapeHtml(String(order.order_status ?? "—"))}</span>
      <span class="badge">Payment: ${escapeHtml(String(order.payment_status ?? "—"))}</span>
      <span class="badge">Method: ${escapeHtml(String(order.payment_method ?? "—"))}</span>
    </div>
    <section class="section">
      <h2>Customer</h2>
      <dl class="grid">
        <div><dt>Name</dt><dd>${escapeHtml(String(order.customer_name ?? "—"))}</dd></div>
        <div><dt>Phone</dt><dd>${escapeHtml(String(order.customer_phone ?? "—"))}</dd></div>
        <div><dt>Email</dt><dd>${escapeHtml(String(order.customer_email ?? "—"))}</dd></div>
        <div><dt>City</dt><dd>${escapeHtml(String(order.city ?? "—"))}</dd></div>
        <div class="full"><dt>Address</dt><dd>${escapeHtml(String(order.address ?? "—"))}</dd></div>
      </dl>
    </section>
    <section class="section">
      <h2>Line items</h2>
      <table>
        <thead><tr><th>Product</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Line</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" style="color:#94a3b8;">No products listed</td></tr>`}</tbody>
      </table>
      <div class="total-row">
        <span>Total</span>
        <span>${formatMoney(Number(order.total_price))}</span>
      </div>
    </section>
    ${notesBlock}
    <footer>Generated ${escapeHtml(new Date().toLocaleString())} · ${escapeHtml(STORE_NAME)}</footer>
  </div>
</body>
</html>`;
}

export function downloadOrderReceipt(order: Record<string, unknown>): void {
  const html = buildOrderReceiptHtml(order);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `order-${order.id}-receipt.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
