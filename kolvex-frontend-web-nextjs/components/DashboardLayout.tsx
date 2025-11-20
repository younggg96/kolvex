"use client";

import { ReactNode } from "react";
import AppSidebar from "./Sidebar";
import Header from "./Header";
import { SidebarProvider, SidebarInset } from "./ui/sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  showHeader?: boolean;
}

export default function DashboardLayout({
  children,
  title = "Dashboard",
  showHeader = true,
}: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-gray-900 dark:text-white font-display transition-colors duration-300 overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0 overflow-hidden">
          {showHeader && <Header title={title} />}
          <div className="flex-1 overflow-hidden">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
