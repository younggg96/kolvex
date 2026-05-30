import AppShell from "@/components/layout/AppShell";
import DashboardServiceWorkerGuard from "@/components/pwa/DashboardServiceWorkerGuard";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DashboardServiceWorkerGuard />
      <AppShell>{children}</AppShell>
    </>
  );
}
