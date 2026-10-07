"use client";

import Link from "next/link";
import LogoIcon from "@/components/common/LogoIcon";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Briefcase,
  MessageCircleIcon,
  ShieldCheck,
  Youtube,
  type LucideIcon,
} from "lucide-react";
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
import { ChatSidebarContent } from "@/components/chat";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { useTranslation } from "@/lib/i18n";
import {
  isProductFeatureEnabled,
  type ProductFeatureId,
} from "@/lib/productFeatures";

const mainNavItemDefs = [
  {
    icon: LayoutDashboard,
    titleKey: "sidebar.chat",
    href: "/dashboard",
    type: "chat-submenu",
    featureId: "chat",
  },
  {
    icon: ShieldCheck,
    titleKey: "sidebar.tradingAnalysis",
    href: "/dashboard/trading-analysis",
    type: "link",
    featureId: "tradingAnalysis",
  },
  {
    icon: Youtube,
    titleKey: "sidebar.youtubeOpinions",
    href: "/dashboard/youtube-opinions",
    type: "link",
    featureId: "youtubeOpinions",
  },
  {
    icon: Briefcase,
    titleKey: "sidebar.portfolio",
    href: "/dashboard/portfolio",
    type: "link",
    featureId: "portfolio",
  },
] satisfies Array<{
  icon: LucideIcon | null;
  titleKey: string;
  href: string;
  type: "chat-submenu" | "link";
  featureId: ProductFeatureId;
}>;

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
  const { state, toggleSidebar, isInitialized } = useSidebar();
  const { profile } = useUserProfileContext();
  const { t } = useTranslation();

  // Resolve translated nav items
  const mainNavItems = mainNavItemDefs
    .filter((item) => isProductFeatureEnabled(item.featureId))
    .map((item) => ({
      ...item,
      title: t(item.titleKey),
    }));
  const bottomNavItems = bottomNavItemDefs.map((item) => ({
    ...item,
    title: t(item.titleKey),
  }));
  const adminNavItem = { ...adminNavItemDef, title: t(adminNavItemDef.titleKey) };
  const [isMounted, setIsMounted] = useState(false);

  const { isMobile, isTablet } = useBreakpoints();

  // Check if user is admin
  const isAdmin = profile?.is_admin ?? false;

  const isCollapsed = isMounted && isInitialized && state === "collapsed";

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href) && href !== "#";
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <SidebarPrimitive
      variant="sidebar"
      collapsible="icon"
      className="border-r border-border"
    >
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full"
            onClick={onNavigate}
          >
            <div className="flex aspect-square size-9 items-center justify-center">
              <LogoIcon size={24} />
            </div>
            <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
              <span className="text-lg font-extrabold">Kolvex</span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 rounded-lg hidden lg:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center"
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
                // Chat submenu with history
                if (item.type === "chat-submenu") {
                  return (
                    <SidebarMenuItem key="chat">
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard")}
                        onClick={onNavigate}
                      >
                        <Link href="/dashboard">
                          <MessageCircleIcon className="size-4" />
                          <span>{t("sidebar.chat")}</span>
                        </Link>
                      </SidebarMenuButton>
                      <ChatSidebarContent isCollapsed={isCollapsed} />
                    </SidebarMenuItem>
                  );
                }
                // link
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      onClick={onNavigate}
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
                    onClick={onNavigate}
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
                    onClick={onNavigate}
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
