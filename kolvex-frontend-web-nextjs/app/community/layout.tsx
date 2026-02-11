import AppShell from "@/components/layout/AppShell";

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
