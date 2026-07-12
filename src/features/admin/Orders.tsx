"use client";

import { AdminPageHeader } from "../../components/admin/AdminUI";
import AdminOrdersTableSection from "../../components/admin/AdminOrdersTableSection";

export default function AdminOrders() {
  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <AdminPageHeader title="Orders" subtitle="Manage customer orders" />
      <AdminOrdersTableSection />
    </div>
  );
}
