import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import { AccountProviders } from "@/components/user/AccountProviders";
import DashboardServiceWorkerGuard from "@/components/pwa/DashboardServiceWorkerGuard";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountProviders>
      <DashboardServiceWorkerGuard />
      <AppShell>{children}</AppShell>
    </AccountProviders>
  );
}
