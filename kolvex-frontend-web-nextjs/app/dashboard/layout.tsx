import AppShell from "@/components/layout/AppShell";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
