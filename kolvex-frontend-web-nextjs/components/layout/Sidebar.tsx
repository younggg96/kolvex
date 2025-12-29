"use client";

import Link from "next/link";
import LogoIcon from "@/components/common/LogoIcon";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  TrendingUp,
  Users,
  Newspaper,
  PanelLeftClose,
  PanelLeft,
  Briefcase,
  Globe,
  Bell,
  Share2,
  ChevronRight,
  Building2,
} from "lucide-react";
import Image from "next/image";
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useBreakpoints } from "@/hooks";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Social Media 子菜单
const socialMediaSubItems = [
  {
    title: "X / Twitter",
    href: "/dashboard/social/twitter",
    iconSrc: "/logo/x.svg",
    disabled: false,
  },
  {
    title: "RedNote",
    href: "/dashboard/social/xiaohongshu",
    iconSrc: "/logo/rednote.svg",
    disabled: false,
  },
  {
    title: "Reddit",
    href: "/dashboard/social/reddit",
    iconSrc: "/logo/reddit.svg",
    disabled: true,
  },
  {
    title: "YouTube",
    href: "/dashboard/social/youtube",
    iconSrc: "/logo/youtube.svg",
    disabled: true,
  },
];

const mainNavItems = [
  {
    icon: LayoutDashboard,
    title: "Home",
    href: "/dashboard",
    type: "link",
  },
  { icon: null, title: "Social", href: "/dashboard/social", type: "submenu" },
  {
    icon: TrendingUp,
    title: "Stocks",
    href: "/dashboard/stocks",
    type: "link",
  },
  {
    icon: Building2,
    title: "Superinvestors",
    href: "/dashboard/investors",
    type: "link",
  },
  {
    icon: Newspaper,
    title: "News",
    href: "/dashboard/news",
    type: "link",
  },
  {
    icon: Users,
    title: "KOL Tracker",
    href: "/dashboard/kol",
    type: "link",
  },
  {
    icon: Briefcase,
    title: "Portfolio",
    href: "/dashboard/portfolio",
    type: "link",
  },
  {
    icon: Globe,
    title: "Community",
    href: "/community",
    type: "link",
  },
];

const bottomNavItems = [
  {
    icon: Bell,
    title: "Notifications",
    href: "/dashboard/notifications",
  },
  {
    icon: Settings,
    title: "Settings",
    href: "/dashboard/settings",
  },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const { state, toggleSidebar, isInitialized } = useSidebar();
  const [isMounted, setIsMounted] = useState(false);
  const [socialOpen, setSocialOpen] = useState(() => {
    // 默认展开如果当前在 social 路由下
    return pathname.startsWith("/dashboard/social");
  });

  const { isMobile, isTablet } = useBreakpoints();
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (href === "/community") {
      return pathname.startsWith("/community");
    }
    return pathname.startsWith(href) && href !== "#";
  };

  const isSocialActive = pathname.startsWith("/dashboard/social");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 当路由变化时，如果进入 social 页面则展开菜单
  useEffect(() => {
    if (pathname.startsWith("/dashboard/social")) {
      setSocialOpen(true);
    }
  }, [pathname]);

  return (
    <SidebarPrimitive
      variant="sidebar"
      collapsible="icon"
      className="border-r border-border-light dark:border-border-dark"
    >
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full"
            onClick={onNavigate}
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
              <LogoIcon size={20} />
            </div>
            <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
              <span className="font-bold text-sm">Kolvex</span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 rounded-lg hidden lg:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center"
            suppressHydrationWarning
          >
            <span suppressHydrationWarning>
              {isMounted && isInitialized && state === "expanded" ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </span>
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarContent>
          {/* Main Navigation */}
          <SidebarGroup>
            <SidebarGroupLabel className="sr-only">
              <span>Kolvex</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map((item) => {
                  // submenu
                  if (item.type === "submenu") {
                    return (
                      <Collapsible
                        key={item.title}
                        open={socialOpen}
                        onOpenChange={setSocialOpen}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton isActive={isSocialActive}>
                              <Share2 />
                              <span>Social</span>
                              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub className="pl-3 pt-1">
                              {socialMediaSubItems.map((subItem) => (
                                <SidebarMenuSubItem key={subItem.href}>
                                  {subItem.disabled ? (
                                    <SidebarMenuSubButton
                                      isActive={false}
                                      className="opacity-50 cursor-not-allowed pointer-events-none"
                                    >
                                      <Image
                                        src={subItem.iconSrc}
                                        alt={subItem.title}
                                        width={16}
                                        height={16}
                                        className="size-4"
                                      />
                                      <span>{subItem.title}</span>
                                      <span className="ml-auto text-[10px] text-muted-foreground">
                                        Soon
                                      </span>
                                    </SidebarMenuSubButton>
                                  ) : (
                                    <SidebarMenuSubButton
                                      asChild
                                      isActive={pathname === subItem.href}
                                    >
                                      <Link
                                        href={subItem.href}
                                        onClick={onNavigate}
                                      >
                                        <Image
                                          src={subItem.iconSrc}
                                          alt={subItem.title}
                                          width={16}
                                          height={16}
                                          className="size-4"
                                        />
                                        <span
                                          className={cn(
                                            "truncate",
                                            subItem.href === pathname
                                              ? "text-primary"
                                              : "text-gray-600 dark:text-white/50"
                                          )}
                                        >
                                          {subItem.title}
                                        </span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  )}
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
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
        </SidebarContent>

        {/* Bottom Navigation */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    onClick={onNavigate}
                  >
                    <Link href={item.href}>
                      <item.icon />
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

interface SidebarWrapperProps {
  children: React.ReactNode;
}

export function SidebarWrapper({ children }: SidebarWrapperProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      {children}
    </SidebarProvider>
  );
}

export default AppSidebar;
