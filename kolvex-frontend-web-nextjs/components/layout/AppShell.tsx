"use client";

import { ReactNode } from "react";
import AppSidebar from "./Sidebar";
import MobileTabBar from "./MobileTabBar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import CommandLayer from "@/components/decision/CommandLayer";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Shared sidebar shell used by Next.js layout files.
 * Provides the persistent sidebar that survives page navigations.
 */
export default function AppShell({ children }: AppShellProps) {
  return (
    <CommandLayer><SidebarProvider defaultOpen={true}>
      <div className="app-workbench flex w-full overflow-hidden bg-background font-display text-foreground">
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0 overflow-hidden">
          {children}
          <MobileTabBar />
        </SidebarInset>
      </div>
    </SidebarProvider></CommandLayer>
  );
}
