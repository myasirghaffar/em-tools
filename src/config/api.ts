/** Base URL for em-tools API (no trailing slash). Defaults to same-origin `/api`. */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const fromRuntime = (
      (window as Window & { __EM_TOOLS_API_BASE__?: string }).__EM_TOOLS_API_BASE__ ?? ""
    ).trim();
    if (fromRuntime) return fromRuntime.replace(/\/$/, "");
  }
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (raw) return raw;
  return "/api";
}
