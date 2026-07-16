"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

function isStaffRole(role: string | undefined) {
  return role === "admin" || role === "salesman";
}

/** Sales users may only use leads, quotes, and their profile. */
function isSalesmanAllowedPath(pathname: string) {
  return (
    pathname === "/leads" ||
    pathname.startsWith("/leads/") ||
    pathname === "/quotes" ||
    pathname.startsWith("/quotes/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/")
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!user || !isStaffRole(user.role)) {
      router.replace("/login");
      return;
    }
    if (user.role === "salesman" && !isSalesmanAllowedPath(pathname)) {
      router.replace("/leads");
    }
  }, [isLoading, user, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF7A00] border-t-transparent" />
      </div>
    );
  }

  if (!user || !isStaffRole(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF7A00] border-t-transparent" />
      </div>
    );
  }

  if (user.role === "salesman" && !isSalesmanAllowedPath(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF7A00] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
