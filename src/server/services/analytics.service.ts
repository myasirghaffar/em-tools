import type { OrderRow } from '../db/schema';
import { orderToFrontend } from '../lib/store-mappers';

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Monday 00:00:00.000 UTC of the week containing `ref` (UTC calendar date). */
function utcStartOfWeekMondayMs(ref: Date): number {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const d = ref.getUTCDate();
  const dow = ref.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return Date.UTC(y, m, d + diff, 0, 0, 0, 0);
}

function formatUtcWeekLabel(wsMs: number, weMs: number): string {
  const ws = new Date(wsMs);
  const we = new Date(weMs);
  const m0 = MONTH_SHORT[ws.getUTCMonth()] ?? '';
  const m1 = MONTH_SHORT[we.getUTCMonth()] ?? '';
  const sameMonth = ws.getUTCMonth() === we.getUTCMonth();
  if (sameMonth) {
    return `${m0} ${ws.getUTCDate()}–${we.getUTCDate()}`;
  }
  return `${m0} ${ws.getUTCDate()} – ${m1} ${we.getUTCDate()}`;
}

function computeWeeklyChart(orders: { created_at: string; total_price: number }[], weeksCount = 12) {
  const anchorMs = utcStartOfWeekMondayMs(new Date());
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const rows: { label: string; sales: number; orders: number }[] = [];
  for (let i = weeksCount - 1; i >= 0; i--) {
    const ws = anchorMs - i * weekMs;
    const we = ws + weekMs - 1;
    let sales = 0;
    let orderCount = 0;
    for (const o of orders) {
      const t = new Date(o.created_at).getTime();
      if (!Number.isFinite(t)) continue;
      if (t >= ws && t <= we) {
        sales += Number(o.total_price) || 0;
        orderCount += 1;
      }
    }
    rows.push({ label: formatUtcWeekLabel(ws, we), sales, orders: orderCount });
  }
  return rows;
}

function computeYearlyChart(orders: { created_at: string; total_price: number }[], span = 6) {
  const currentYear = new Date().getUTCFullYear();
  const from = currentYear - (span - 1);
  const rows: { label: string; sales: number; orders: number }[] = [];
  for (let y = from; y <= currentYear; y++) {
    let sales = 0;
    let orderCount = 0;
    for (const o of orders) {
      const d = new Date(o.created_at);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getUTCFullYear() === y) {
        sales += Number(o.total_price) || 0;
        orderCount += 1;
      }
    }
    rows.push({ label: String(y), sales, orders: orderCount });
  }
  return rows;
}

export function buildAnalytics(
  orders: OrderRow[],
  customerCount: number,
  productCount: number,
): {
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  monthlySales: number[];
  orderGrowth: number[];
  chartSeries: {
    weekly: { label: string; sales: number; orders: number }[];
    monthly: { label: string; sales: number; orders: number }[];
    yearly: { label: string; sales: number; orders: number }[];
  };
} {
  const fo = orders.map((o) => orderToFrontend(o));
  const year = new Date().getUTCFullYear();
  const totalSales = fo.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
  const monthlySales = Array.from({ length: 12 }, (_, i) =>
    fo
      .filter((o) => {
        const d = new Date(o.created_at);
        if (Number.isNaN(d.getTime())) return false;
        return d.getUTCMonth() === i && d.getUTCFullYear() === year;
      })
      .reduce((s, o) => s + (Number(o.total_price) || 0), 0),
  );
  const orderGrowth = Array.from({ length: 12 }, (_, i) =>
    fo.filter((o) => {
      const d = new Date(o.created_at);
      if (Number.isNaN(d.getTime())) return false;
      return d.getUTCMonth() === i && d.getUTCFullYear() === year;
    }).length,
  );
  const monthlyChart = MONTH_SHORT.map((label, i) => ({
    label,
    sales: monthlySales[i] ?? 0,
    orders: orderGrowth[i] ?? 0,
  }));
  return {
    totalSales,
    totalOrders: fo.length,
    totalCustomers: customerCount,
    totalProducts: productCount,
    monthlySales,
    orderGrowth,
    chartSeries: {
      weekly: computeWeeklyChart(fo, 12),
      monthly: monthlyChart,
      yearly: computeYearlyChart(fo, 6),
    },
  };
}
