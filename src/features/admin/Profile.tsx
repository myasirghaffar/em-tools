"use client";

import { useMemo } from "react";
import { Mail, ShieldCheck, UserCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AdminPageHeader, AdminPanel } from "../../components/admin/AdminUI";

export default function AdminProfile() {
  const { user } = useAuth();

  const initials = useMemo(() => {
    const basis = user?.name || user?.email || "A";
    return basis.charAt(0).toUpperCase();
  }, [user?.email, user?.name]);

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      <AdminPageHeader title="Profile" subtitle="Your admin account details." />

      <AdminPanel className="p-0 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-[#FF7A00] to-[#ff9429] text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
              <span className="text-2xl font-bold">{initials}</span>
            </div>
            <div>
              <p className="text-lg font-semibold">{user?.name || "Administrator"}</p>
              <p className="text-white/80">{user?.email}</p>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <UserCircle2 className="w-5 h-5 text-[#FF7A00]" />
              <p className="font-bold text-slate-900">Role</p>
            </div>
            <p className="text-gray-700">Admin</p>
            <p className="text-sm text-gray-500 mt-1">Full access to store management.</p>
          </div>

          <div className="rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Mail className="w-5 h-5 text-[#FF7A00]" />
              <p className="font-bold text-slate-900">Email</p>
            </div>
            <p className="text-gray-700">{user?.email}</p>
            <p className="text-sm text-gray-500 mt-1">Used for login and notifications.</p>
          </div>

          <div className="rounded-xl border border-gray-100 p-5 md:col-span-2">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="w-5 h-5 text-[#FF7A00]" />
              <p className="font-bold text-slate-900">Security</p>
            </div>
            <p className="text-gray-700">Session-based authentication</p>
            <p className="text-sm text-gray-500 mt-1">
              We can add password change, activity log, and 2FA in Settings later.
            </p>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
