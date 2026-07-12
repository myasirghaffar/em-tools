"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LeadRecord } from "../../lib/api";

const STATUS_ORDER = ["Won", "Assigned", "In Progress", "New", "Lost"] as const;
const STATUS_COLORS: Record<(typeof STATUS_ORDER)[number], string> = {
  Won: "#16A34A",
  Assigned: "#0F172A",
  "In Progress": "#F59E0B",
  New: "#F97316",
  Lost: "#EF4444",
};

type ChartRow = { label: string; count: number; fill: string };

type Props = {
  leads: LeadRecord[];
  /** When set, only leads assigned to or created by this user id */
  scopeUserId?: string;
  /**
   * Fill the parent’s vertical space (parent should be a flex column with a defined height,
   * e.g. grid row beside a tall form).
   */
  fillHeight?: boolean;
  /**
   * Taller chart + footer summary (e.g. salesman dashboard), aligned with admin bar charts.
   * Ignored when `fillHeight` is true (leads page keeps a compact chart).
   */
  variant?: "default" | "detailed";
};

function LeadTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{row.label}</p>
      <p className="text-slate-600">
        <span className="font-medium text-[#F97316]">{row.count}</span> lead{row.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export default function LeadStatusChart({ leads, scopeUserId, fillHeight, variant = "default" }: Props) {
  const detailed = !fillHeight && variant === "detailed";

  const { chartData, total, listLen } = useMemo(() => {
    const list = scopeUserId
      ? leads.filter(
          (l) => l.createdByUserId === scopeUserId || l.assignedToUserId === scopeUserId,
        )
      : leads;
    const counts: Record<string, number> = {};
    list.forEach((l) => {
      counts[l.status] = (counts[l.status] || 0) + 1;
    });
    const data: ChartRow[] = STATUS_ORDER.map((k) => ({
      label: k,
      count: counts[k] ?? 0,
      fill: STATUS_COLORS[k],
    }));
    const t = data.reduce((a, b) => a + b.count, 0);
    return { chartData: data, total: t, listLen: list.length };
  }, [leads, scopeUserId]);

  if (listLen === 0) {
    return (
      <div
        className={
          fillHeight
            ? "flex flex-1 min-h-[12rem] w-full items-center justify-center text-sm text-slate-500"
            : detailed
              ? "flex min-h-[280px] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500"
              : "flex h-72 items-center justify-center text-sm text-slate-500 sm:h-80"
        }
      >
        No leads to chart yet.
      </div>
    );
  }

  const chartInner = (
    <ResponsiveContainer width="100%" height="100%" minHeight={detailed ? 280 : fillHeight ? 200 : 260}>
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 8, left: 4, bottom: detailed ? 8 : 4 }}
        barCategoryGap="16%"
      >
        <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
          interval={0}
          {...(detailed ? {} : { angle: -28, textAnchor: "end", height: 52 })}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip cursor={{ fill: "rgba(255, 122, 0, 0.08)" }} content={<LeadTooltip />} />
        <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={detailed ? 44 : 40} animationDuration={700}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.count > 0 ? entry.fill : "#e2e8f0"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  if (fillHeight) {
    return (
      <div className="flex h-full w-full min-h-0 flex-1 flex-col">
        <div className="min-h-[12rem] w-full flex-1">{chartInner}</div>
      </div>
    );
  }

  if (detailed) {
    return (
      <div className="w-full space-y-4">
        <div className="h-[300px] w-full min-w-0">{chartInner}</div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm">
          <p className="text-slate-600">
            <span className="font-semibold text-slate-900">{total}</span> lead{total === 1 ? "" : "s"} in your pipeline
          </p>
          <p className="text-xs text-slate-500">Hover a bar for details.</p>
        </div>
      </div>
    );
  }

  return <div className="h-72 w-full sm:h-80">{chartInner}</div>;
}
