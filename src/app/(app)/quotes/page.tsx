import { Suspense } from "react";
import QuotesPage from "@/features/leads/QuotesPage";

export default function QuotesRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FF7A00]" />
        </div>
      }
    >
      <QuotesPage area="admin" />
    </Suspense>
  );
}
