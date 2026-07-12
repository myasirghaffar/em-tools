export {};

declare global {
  interface Window {
    /** Optional runtime override for API base (no trailing slash). */
    __EM_TOOLS_API_BASE__?: string;
  }

  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_API_URL?: string;
      NEXT_PUBLIC_APP_URL?: string;
      NEXT_PUBLIC_BASE_PATH?: string;
    }
  }
}
