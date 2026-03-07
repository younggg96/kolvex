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
  BarChart3,
  MessageCircleIcon,
  ShieldCheck,
  Activity,
} from "lucide-react";
import Image from "next/image";
import UserMenu from "@/components/user/UserMenu";
import { Button } from "@/components/ui/button";
import { getUnreadCount } from "@/lib/notificationApi";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useBreakpoints } from "@/hooks";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChatSidebarContent } from "@/components/chat";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { useTranslation } from "@/lib/i18n";

// Social Media sub-items (titles are brand names — not translated)
const socialMediaSubItems = [
  {
    title: "X / Twitter",
    href: "/dashboard/social/twitter",
    iconSrc: "/logo/x.svg",
    disabled: false,
  },
  {
    title: "Xiaohongshu",
    href: "/dashboard/social/xiaohongshu",
    iconSrc: "/logo/xiaohongshu.svg",
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

const mainNavItemDefs = [
  {
    icon: LayoutDashboard,
    titleKey: "sidebar.chat",
    href: "/dashboard",
    type: "chat-submenu",
  },
  {
    icon: BarChart3,
    titleKey: "sidebar.analytics",
    href: "/dashboard/analytics",
    type: "link",
  },
  { icon: null, titleKey: "sidebar.social", href: "/dashboard/social", type: "submenu" },
  {
    icon: TrendingUp,
    titleKey: "sidebar.stocks",
    href: "/dashboard/stocks",
    type: "link",
  },
  {
    icon: Activity,
    titleKey: "sidebar.optionsFlow",
    href: "/dashboard/options-flow",
    type: "link",
  },
  {
    icon: ShieldCheck,
    titleKey: "sidebar.tradingAnalysis",
    href: "/dashboard/trading-analysis",
    type: "link",
  },
  {
    icon: Building2,
    titleKey: "sidebar.superinvestors",
    href: "/dashboard/investors",
    type: "link",
  },
  {
    icon: Newspaper,
    titleKey: "sidebar.news",
    href: "/dashboard/news",
    type: "link",
  },
  {
    icon: Users,
    titleKey: "sidebar.kolTracker",
    href: "/dashboard/kol",
    type: "link",
  },
  {
    icon: Briefcase,
    titleKey: "sidebar.portfolio",
    href: "/dashboard/portfolio",
    type: "link",
  },
  {
    icon: Globe,
    titleKey: "sidebar.community",
    href: "/community",
    type: "link",
  },
];

const bottomNavItemDefs = [
  {
    icon: Bell,
    titleKey: "sidebar.notifications",
    href: "/dashboard/notifications",
  },
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
  const mainNavItems = mainNavItemDefs.map((item) => ({
    ...item,
    title: t(item.titleKey),
  }));
  const bottomNavItems = bottomNavItemDefs.map((item) => ({
    ...item,
    title: t(item.titleKey),
  }));
  const adminNavItem = { ...adminNavItemDef, title: t(adminNavItemDef.titleKey) };
  const [isMounted, setIsMounted] = useState(false);
  const [socialOpen, setSocialOpen] = useState(() => {
    return pathname.startsWith("/dashboard/social");
  });
  const [chatOpen, setChatOpen] = useState(() => {
    return pathname === "/dashboard";
  });
  const [unreadCount, setUnreadCount] = useState(0);

  const { isMobile, isTablet } = useBreakpoints();

  // Check if user is admin
  const isAdmin = profile?.is_admin ?? false;

  // Check if we're on the Chat page
  const isChatPage = pathname === "/dashboard";
  const isCollapsed = isMounted && isInitialized && state === "collapsed";

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

  // 获取未读通知数量
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const count = await getUnreadCount();
        setUnreadCount(count);
      } catch (error) {
        // 静默处理错误，保持 count 为 0
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60 * 1000 * 60); // 每小时刷新一次
    return () => clearInterval(interval);
  }, []);

  // 当路由变化时，如果进入 social 页面则展开菜单
  useEffect(() => {
    if (pathname.startsWith("/dashboard/social")) {
      setSocialOpen(true);
    }
  }, [pathname]);

  // 当路由变化时，如果进入 chat 页面则展开菜单
  useEffect(() => {
    if (pathname === "/dashboard") {
      setChatOpen(true);
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
                // Social submenu
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
                            <span>{t('sidebar.social')}</span>
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
                                      {t("common.soon")}
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
                                        className={cn(
                                          "size-4",
                                          subItem.title === "X / Twitter"
                                            ? "dark:invert"
                                            : ""
                                        )}
                                      />
                                      <span
                                        className={cn(
                                          "truncate",
                                          subItem.href === pathname
                                            ? "text-primary"
                                            : "text-gray-600 dark:text-white"
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
                      {item.title === "Notifications" && unreadCount > 0 && (
                        <span className="flex h-4 min-w-4 rounded-full bg-red-500 items-center justify-center text-[10px] font-medium text-white ml-auto">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
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
