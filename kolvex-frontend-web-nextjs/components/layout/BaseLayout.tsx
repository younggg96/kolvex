import { ReactNode } from "react";
import LandingHeader from "@/components/layout/LandingHeader";
import Footer from "@/components/layout/Footer";

interface BaseLayoutProps {
  children: ReactNode;
}

export default function BaseLayout({ children }: BaseLayoutProps) {
  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark transition-colors duration-300">
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-grid z-0"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background-light/90 dark:via-background-dark/90 to-background-light dark:to-background-dark z-0"></div>

      {/* Header */}
      <LandingHeader />

      {/* Main Content */}
      {children}

      {/* Footer */}
      <Footer />
    </div>
  );
}
