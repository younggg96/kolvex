"use client";

import { ReactNode } from "react";
import AppSidebar from "./Sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Shared sidebar shell used by Next.js layout files.
 * Provides the persistent sidebar that survives page navigations.
 */
export default function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background text-foreground font-display transition-colors duration-300 overflow-hidden" style={{ transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0 overflow-hidden">
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
