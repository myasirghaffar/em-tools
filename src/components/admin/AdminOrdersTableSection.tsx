"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Search,
  Eye,
  X,
  Download,
  User,
  Phone,
  Mail,
  MapPin,
  Home,
  Package,
  Calendar,
  CreditCard,
} from "lucide-react";
import { AdminPanel, AdminTablePagination, AdminTableShell, StatusPill } from "./AdminUI";
import { useAdminTablePagination } from "../../hooks/useAdminTablePagination";
import Select from "../ui/Select";
import { useScrollLock } from "../../hooks/useScrollLock";
import { downloadOrderReceipt } from "../../lib/orderReceipt";
import { toastError, toastSuccess } from "../../lib/toast";

const ORDER_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const ORDER_STATUS_ROW_OPTIONS = ORDER_STATUS_FILTER_OPTIONS.filter((o) => o.value !== "");

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-[#FF7A00]/15 text-[#b45309]",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export type AdminOrdersTableSectionProps = {
  /** Optional block above the table (e.g. dashboard section title) */
  shellHeader?: ReactNode;
};

export default function AdminOrdersTableSection({ shellHeader }: AdminOrdersTableSectionProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  useScrollLock(!!selectedOrder);

  useEffect(() => {
    void fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { fetchAdminBootstrap, getAdminBootstrapCache, fetchOrders: apiFetchOrders } =
        await import("../../lib/api");
      const cached = getAdminBootstrapCache();
      if (cached?.orders) {
        setOrders(Array.isArray(cached.orders) ? cached.orders : []);
        setLoading(false);
        void apiFetchOrders().then((fresh) => setOrders(Array.isArray(fresh) ? fresh : []));
        return;
      }
      const boot = await fetchAdminBootstrap();
      setOrders(Array.isArray(boot.orders) ? boot.orders : []);
    } catch (err) {
      console.error("Fetch error:", err);
      toastError("Could not load orders.");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (id: number, status: string) => {
    if (updatingOrderId != null) return;
    setUpdatingOrderId(id);
    try {
      const { updateOrderStatus: apiUpdateOrderStatus } = await import("../../lib/api");
      await apiUpdateOrderStatus(id, status);
      void fetchOrders();
      toastSuccess("Order status updated");
    } catch (err) {
      console.error("Error:", err);
      toastError("Could not update order status.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id?.toString().includes(searchTerm);
    const matchesStatus = !statusFilter || order.order_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const {
    page,
    setPage,
    pageItems,
    totalPages,
    startItem,
    endItem,
    totalItems,
  } = useAdminTablePagination(filteredOrders, searchTerm, statusFilter);

  return (
    <>
      <AdminPanel className="flex flex-col gap-4 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 w-full rounded-[10px] border border-gray-200 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
          />
        </div>
        <div className="w-full shrink-0 sm:w-52">
          <Select
            options={ORDER_STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All Status"
          />
        </div>
      </AdminPanel>

      <AdminTableShell>
        {shellHeader ? <div className="min-w-0">{shellHeader}</div> : null}
        <div className="admin-table-scroll min-w-0 touch-pan-x overflow-x-auto overflow-y-visible">
          <table className="w-full min-w-full">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Order ID
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Products
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Payment
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Date
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[#FF7A00]" />
                  </td>
                </tr>
              ) : filteredOrders.length > 0 ? (
                pageItems.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="font-medium text-slate-900">#{order.id}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{order.customer_name}</p>
                        <p className="text-sm text-gray-500">{order.customer_phone}</p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {Array.isArray(order.products) ? order.products.length : 0} items
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[#FF7A00]">
                      Rs. {order.total_price?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill
                        label={order.payment_status || "pending"}
                        variant={order.payment_status === "paid" ? "success" : "warning"}
                      />
                    </td>
                    <td className="relative z-20 min-w-[9.5rem] overflow-visible px-6 py-4 whitespace-nowrap">
                      <Select
                        size="sm"
                        dropdownPosition="above"
                        options={ORDER_STATUS_ROW_OPTIONS}
                        value={order.order_status || "pending"}
                        onChange={(v) => void updateOrderStatus(order.id, v)}
                        disabled={updatingOrderId === order.id}
                        triggerClassName={`rounded-full border-0 shadow-none ring-0 ${statusColors[order.order_status || "pending"]}`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="rounded-lg p-2 text-[#FF7A00] transition-colors hover:bg-[#FF7A00]/10"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No orders found
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

      {selectedOrder ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOrder(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-modal-title"
            className="flex max-h-[min(90vh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/80 sm:max-w-xl"
          >
            <header className="relative shrink-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] px-5 pb-5 pt-5 text-white sm:px-6 sm:pb-6 sm:pt-6">
              <div
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FF7A00] via-amber-400 to-[#FF7A00]"
                aria-hidden
              />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    Order details
                  </p>
                  <h2 id="order-modal-title" className="mt-1 truncate text-2xl font-bold tracking-tight">
                    #{selectedOrder.id}
                  </h2>
                  <p className="mt-2 flex items-center gap-2 text-sm text-white/70">
                    <Calendar className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
                    {selectedOrder.created_at
                      ? new Date(selectedOrder.created_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/90 ring-1 ring-white/15 transition-colors hover:bg-white/20"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill
                  label={selectedOrder.order_status || "pending"}
                  variant={
                    selectedOrder.order_status === "delivered"
                      ? "success"
                      : selectedOrder.order_status === "shipped"
                        ? "info"
                        : selectedOrder.order_status === "processing"
                          ? "warning"
                          : selectedOrder.order_status === "cancelled"
                            ? "danger"
                            : "default"
                  }
                />
                <StatusPill
                  label={selectedOrder.payment_status || "pending"}
                  variant={selectedOrder.payment_status === "paid" ? "success" : "warning"}
                />
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/90 px-5 py-5 sm:px-6 sm:py-6">
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF7A00]/12 text-[#ea580c]">
                  <CreditCard className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Payment method</p>
                  <p className="text-sm font-semibold capitalize text-slate-900">
                    {selectedOrder.payment_method
                      ? String(selectedOrder.payment_method).replace(/_/g, " ")
                      : "Not specified"}
                  </p>
                </div>
              </div>

              <section className="mb-5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-400">Customer</h3>
                <ul className="grid gap-4 sm:grid-cols-2">
                  <li className="flex gap-3">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Name</p>
                      <p className="font-semibold text-slate-900">{selectedOrder.customer_name}</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Phone</p>
                      <p className="font-semibold text-slate-900">{selectedOrder.customer_phone}</p>
                    </div>
                  </li>
                  <li className="flex gap-3 sm:col-span-2">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0 break-all">
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="font-semibold text-slate-900">{selectedOrder.customer_email}</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">City</p>
                      <p className="font-semibold text-slate-900">{selectedOrder.city}</p>
                    </div>
                  </li>
                  <li className="flex gap-3 sm:col-span-2">
                    <Home className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Address</p>
                      <p className="font-semibold text-slate-900">{selectedOrder.address}</p>
                    </div>
                  </li>
                </ul>
              </section>

              <section className="mb-5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-400">Products</h3>
                <ul className="space-y-3">
                  {Array.isArray(selectedOrder.products) &&
                    selectedOrder.products.map((item: any, index: number) => {
                      const qty = Number(item.quantity) || 0;
                      const unit = Number(item.price) || 0;
                      const line = unit * qty;
                      return (
                        <li
                          key={index}
                          className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 ring-1 ring-slate-100/80"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FF7A00]/12 text-[#ea580c]">
                            <Package className="h-5 w-5" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold leading-snug text-slate-900">{item.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {qty} × Rs. {unit.toLocaleString()}
                            </p>
                          </div>
                          <p className="shrink-0 self-center text-sm font-bold tabular-nums text-[#ea580c]">
                            Rs. {line.toLocaleString()}
                          </p>
                        </li>
                      );
                    })}
                </ul>
              </section>

              <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/90 px-4 py-3.5 sm:px-5">
                <span className="text-sm font-bold text-slate-800">Order total</span>
                <span className="text-lg font-extrabold tabular-nums text-[#ea580c]">
                  Rs. {selectedOrder.total_price?.toLocaleString() || 0}
                </span>
              </div>

              <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Notes</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  {selectedOrder.notes?.trim() ? selectedOrder.notes : "No notes for this order."}
                </p>
              </section>
            </div>

            <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="order-2 h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:order-1"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadOrderReceipt(selectedOrder);
                  toastSuccess("Receipt downloaded");
                }}
                className="order-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#FF7A00] px-4 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-colors hover:bg-[#e86e00] sm:order-2"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                Download receipt
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
