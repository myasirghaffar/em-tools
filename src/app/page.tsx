"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user || (user.role !== "admin" && user.role !== "salesman")) {
      router.replace("/login");
      return;
    }
    router.replace(user.role === "salesman" ? "/leads" : "/dashboard");
  }, [isLoading, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF7A00] border-t-transparent" />
    </div>
  );
}
