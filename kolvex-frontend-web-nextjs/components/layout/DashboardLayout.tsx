"use client";

import { ReactNode } from "react";
import AppSidebar from "./Sidebar";
import Header from "./Header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  showHeader?: boolean;
  /** Tailwind CSS classes for responsive header visibility, e.g. "lg:hidden" */
  headerClassName?: string;
  hasSidebarTrigger?: boolean;
  headerLeftAction?: ReactNode;
  headerActions?: ReactNode;
  /** Disable page transition animation */
  noTransition?: boolean;
}

export default function DashboardLayout({
  children,
  title = "Dashboard",
  showHeader = true,
  headerClassName,
  hasSidebarTrigger = true,
  headerLeftAction,
  headerActions,
  noTransition = false,
}: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-gray-900 dark:text-white font-display transition-colors duration-300 overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0 overflow-hidden">
          {showHeader && (
            <div className={headerClassName}>
              <Header
                title={title}
                hasSidebarTrigger={hasSidebarTrigger}
                leftAction={headerLeftAction}
                actions={headerActions}
              />
            </div>
          )}
          <div 
            className={`flex flex-col flex-1 overflow-hidden ${
              noTransition ? "" : "animate-page-enter"
            }`}
          >
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
