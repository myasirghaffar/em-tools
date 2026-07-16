"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Mail,
  Settings,
  Menu,
  X,
  LogOut,
  UserCircle2,
  FolderOpen,
  UserPlus,
  UserCog,
  FileText,
  ClipboardList,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useScrollLock } from "../../hooks/useScrollLock";
import { ButtonSpinner } from "../ui/Button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isSalesman } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  useScrollLock(sidebarOpen);

  const closeMobileDrawer = () => setSidebarOpen(false);

  const homePath = isSalesman ? "/leads" : "/dashboard";

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true, staff: "admin" as const },
    { path: "/leads", icon: FolderOpen, label: "Leads", staff: "all" as const },
    { path: "/quotes", icon: FileText, label: "Quotes", staff: "all" as const },
    { path: "/sales-team", icon: UserPlus, label: "Sales team", staff: "admin" as const },
    { path: "/users", icon: UserCog, label: "Users", staff: "admin" as const },
    { path: "/quote-templates", icon: ClipboardList, label: "Quote templates", staff: "admin" as const },
    { path: "/consultations", icon: MessageSquare, label: "Consultations", staff: "admin" as const },
    { path: "/contact-messages", icon: Mail, label: "Contact messages", staff: "admin" as const },
    { path: "/settings", icon: Settings, label: "Settings", staff: "admin" as const },
  ].filter((item) => item.staff === "all" || !isSalesman);

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 min-h-0 flex-col bg-white text-slate-900 transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 transition-transform duration-300 ease-in-out border-r border-gray-200`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-gray-200">
          <Link href={homePath} onClick={closeMobileDrawer} className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/em-logo-only.png"
              alt="EnergyMart"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 object-contain"
              priority
            />
            <span className="text-lg font-bold truncate">EM Tools</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-slate-900"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.path
                : pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={closeMobileDrawer}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive
                      ? "bg-[#FF7A00] text-white"
                      : "text-gray-500 hover:bg-gray-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-gray-200 p-4 space-y-2">
            <button
              type="button"
              onClick={async () => {
                if (loggingOut) return;
                setLoggingOut(true);
                try {
                  closeMobileDrawer();
                  await logout();
                  router.push("/login");
                } finally {
                  setLoggingOut(false);
                }
              }}
              disabled={loggingOut}
              className="flex w-full items-center space-x-3 px-4 py-3 rounded-xl text-left text-gray-500 transition-colors hover:bg-gray-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              aria-busy={loggingOut}
            >
              {loggingOut ? <ButtonSpinner className="h-5 w-5" /> : <LogOut className="w-5 h-5" />}
              <span>{loggingOut ? "Logging out..." : "Logout"}</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:ml-72 flex flex-col min-h-0 min-w-0 w-full overflow-hidden">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-3 sm:px-6 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-slate-900"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-slate-900 hidden sm:block">
            EnergyMart Tools
          </h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 hidden sm:inline">{user?.email}</span>
            <Link
              href="/profile"
              className="w-10 h-10 bg-[#FF7A00] rounded-full flex items-center justify-center text-white font-bold hover:bg-[#e86e00] transition-colors"
              title="Profile"
            >
              <span className="sr-only">Profile</span>
              <UserCircle2 className="w-6 h-6" />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto min-h-0 min-w-0 p-3 sm:p-6">
          {children}
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
