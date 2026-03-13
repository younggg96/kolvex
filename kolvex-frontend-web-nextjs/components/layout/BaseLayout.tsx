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
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-grid z-0 pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/90 to-background z-0 pointer-events-none"></div>

      {/* Header */}
      <LandingHeader />

      {/* Main Content with Page Transition */}
      <div className="animate-page-enter flex-1 flex flex-col">{children}</div>

      {/* Footer */}
      {hasFooter && <Footer />}
    </div>
  );
}
