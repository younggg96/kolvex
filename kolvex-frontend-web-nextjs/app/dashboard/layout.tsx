import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import DashboardServiceWorkerGuard from "@/components/pwa/DashboardServiceWorkerGuard";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
