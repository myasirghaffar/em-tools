"use client";

import { ToastContainer } from "react-toastify";
import { AuthProvider } from "@/context/AuthContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <ToastContainer theme="colored" newestOnTop closeOnClick draggable={false} />
    </AuthProvider>
  );
}
