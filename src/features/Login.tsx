"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import { ButtonSpinner } from "../components/ui/Button";
import { useAuth, isAuthApiError } from "../context/AuthContext";
import { toastError, toastSuccess } from "../lib/toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, logout } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (!loggedInUser) {
        const msg = "Invalid email or password";
        setError(msg);
        toastError(msg);
        return;
      }
      if (loggedInUser.role !== "admin") {
        await logout();
        const msg = "This app is for admin accounts only.";
        setError(msg);
        toastError(msg);
        return;
      }
      toastSuccess("Signed in");
      router.replace("/dashboard");
    } catch (err) {
      if (isAuthApiError(err)) {
        if (err.code === "AUTH_EMAIL_NOT_VERIFIED") {
          const msg =
            "Please verify your email before signing in. Contact an administrator if you need a new link.";
          setError(msg);
          toastError(msg);
        } else {
          setError(err.message);
          toastError(err.message);
        }
      } else {
        const msg = "Login failed. Please try again.";
        setError(msg);
        toastError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100">
        <div className="bg-[#0B2A4A] text-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <Image
              src="/em-logo-only.png"
              alt="EnergyMart"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              priority
            />
            <span className="text-xl font-bold">
              EM Tools<span className="text-[#FF7A00]"> · EnergyMart</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold">Admin sign in</h1>
          <p className="text-gray-300 mt-1">EnergyMart Tools — admin access only</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              <p>{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                placeholder="Enter password"
                required
                minLength={8}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF7A00] py-3 font-semibold text-white transition-colors hover:bg-[#FF7A00]/90 disabled:cursor-not-allowed disabled:opacity-70"
            aria-busy={loading}
          >
            {loading ? <ButtonSpinner /> : null}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
