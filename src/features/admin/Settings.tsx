"use client";

import { useState } from "react";
import { Save, Shield, Bell, Store, Check } from "lucide-react";
import { AdminPageHeader, AdminPanel } from "../../components/admin/AdminUI";
import { ButtonSpinner } from "../../components/ui/Button";
import { toastSuccess } from "../../lib/toast";

export default function AdminSettings() {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    storeName: "energymart.pk",
    supportEmail: "support@energymart.pk",
    orderNotifications: true,
    lowStockAlerts: true,
  });

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toastSuccess("Settings saved");
  };

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      <AdminPageHeader
        title="Settings"
        subtitle="Manage store preferences and admin options."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        <AdminPanel className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#FF7A00]/10 flex items-center justify-center">
              <Store className="w-5 h-5 text-[#FF7A00]" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Store</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Store name</label>
              <input
                value={settings.storeName}
                onChange={(e) => setSettings((s) => ({ ...s, storeName: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Support email</label>
              <input
                value={settings.supportEmail}
                onChange={(e) => setSettings((s) => ({ ...s, supportEmail: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-[10px] bg-[#FF7A00] text-white font-semibold hover:bg-[#e86e00] disabled:opacity-60"
              aria-busy={saving}
            >
              {saving ? <ButtonSpinner className="h-5 w-5" /> : <Save className="w-5 h-5" />}
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </AdminPanel>

        <AdminPanel className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FF7A00]/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#FF7A00]" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Notifications</h2>
          </div>

          <SettingsCheckbox
            checked={settings.orderNotifications}
            onChange={(v) => setSettings((s) => ({ ...s, orderNotifications: v }))}
            title="Order notifications"
            description="Get notified when new orders arrive."
          />
          <SettingsCheckbox
            checked={settings.lowStockAlerts}
            onChange={(v) => setSettings((s) => ({ ...s, lowStockAlerts: v }))}
            title="Low stock alerts"
            description="Warn when product stock is low."
          />

          <div className="pt-2 border-t">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-[#FF7A00]" />
              <p className="font-bold text-slate-900">Security</p>
            </div>
            <p className="text-sm text-gray-600">
              For now, admin security is managed via your login session. (We can add password
              change + 2FA later.)
            </p>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}

function SettingsCheckbox({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className="mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 border-slate-300 bg-white transition-colors peer-checked:border-[#FF7A00] peer-checked:bg-[#FF7A00] peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF7A00]/35 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
        aria-hidden
      >
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </span>
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </label>
  );
}
