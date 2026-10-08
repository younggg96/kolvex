"use client";

import Link from "next/link";
import LogoIcon from "@/components/common/LogoIcon";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Settings, PanelLeftClose, PanelLeft, ShieldCheck } from "lucide-react";
import { MAIN_NAV_ITEMS, isNavItemActive } from "./navItems";
import UserMenu from "@/components/user/UserMenu";
import { Button } from "@/components/ui/button";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { useBreakpoints } from "@/hooks";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { useTranslation } from "@/lib/i18n";
import { isProductFeatureEnabled } from "@/lib/productFeatures";

const bottomNavItemDefs = [
  {
    icon: Settings,
    titleKey: "sidebar.settings",
    href: "/dashboard/settings",
  },
];

const adminNavItemDef = {
  icon: ShieldCheck,
  titleKey: "sidebar.admin",
  href: "/dashboard/admin",
};

interface AppSidebarProps {
  onNavigate?: () => void;
}

function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const {
    state,
    toggleSidebar,
    isInitialized,
    isMobile: sidebarIsMobile,
    setOpenMobile,
  } = useSidebar();
  const { profile } = useUserProfileContext();
  const { t } = useTranslation();

  // Resolve translated nav items
  const mainNavItems = MAIN_NAV_ITEMS.filter((item) =>
    isProductFeatureEnabled(item.featureId),
  ).map((item) => ({
    ...item,
    title: t(item.titleKey),
  }));
  const bottomNavItems = bottomNavItemDefs.map((item) => ({
    ...item,
    title: t(item.titleKey),
  }));
  const adminNavItem = {
    ...adminNavItemDef,
    title: t(adminNavItemDef.titleKey),
  };
  const [isMounted, setIsMounted] = useState(false);

  const { isMobile, isTablet } = useBreakpoints();

  // Check if user is admin
  const isAdmin = profile?.is_admin ?? false;

  const handleNavigate = () => {
    setOpenMobile(false);
    onNavigate?.();
  };

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  const isActive = (href: string) => isNavItemActive(pathname, href);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <SidebarPrimitive
      variant="sidebar"
      collapsible="icon"
      className="border-r border-border/70"
    >
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full"
            onClick={handleNavigate}
          >
            <div className="flex aspect-square size-8 items-center justify-center">
              <LogoIcon size={22} />
            </div>
            <span className="text-[17px] font-bold tracking-[-0.02em] group-data-[collapsible=icon]:hidden">
              Kolvex
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden h-8 w-8 text-muted-foreground hover:text-foreground lg:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center"
            suppressHydrationWarning
            title={t("sidebar.toggleSidebar")}
          >
            <span suppressHydrationWarning>
              {isMounted && isInitialized && state === "expanded" ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </span>
            <span className="sr-only">{t("sidebar.toggleSidebar")}</span>
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="sr-only">
            <span>Kolvex</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      onClick={handleNavigate}
                    >
                      <Link href={item.href}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom Navigation */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Admin Menu - Only visible to admins */}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(adminNavItem.href)}
                    onClick={handleNavigate}
                  >
                    <Link href={adminNavItem.href}>
                      <adminNavItem.icon className="size-4" />
                      <span>{adminNavItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {bottomNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    onClick={handleNavigate}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu
          isCollapsed={
            isMounted &&
            isInitialized &&
            state === "collapsed" &&
            !isMobile &&
            !isTablet
          }
        />
      </SidebarFooter>
    </SidebarPrimitive>
  );
}

export default AppSidebar;
