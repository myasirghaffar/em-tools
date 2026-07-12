import AuthGate from "@/components/AuthGate";
import AdminLayout from "@/components/admin/AdminLayout";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <AdminLayout>{children}</AdminLayout>
    </AuthGate>
  );
}
