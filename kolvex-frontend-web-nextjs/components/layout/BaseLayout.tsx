import { ReactNode } from "react";
import LandingHeader from "@/components/layout/LandingHeader";
import Footer from "@/components/layout/Footer";

interface BaseLayoutProps {
  children: ReactNode;
  hasFooter?: boolean;
}

export default function BaseLayout({
  children,
  hasFooter = true,
}: BaseLayoutProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-y-auto bg-background transition-colors duration-300">

      {/* Header */}
      <LandingHeader />

      {/* Main Content with Page Transition */}
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>

      {/* Footer */}
      {hasFooter && <Footer />}
    </div>
  );
}
