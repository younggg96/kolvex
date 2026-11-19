"use client";

import Link from "next/link";
import KolvexWordmark from "@/components/common/KolvexWordmark";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Search,
  ShieldCheck,
  MessageSquareText,
} from "lucide-react";
import { useDecisionCommand } from "@/components/decision/CommandLayer";
import { useCopy } from "@/components/decision/shared";
import {
  MAIN_NAV_ITEMS,
  NAV_GROUPS,
  SEARCH_HREF,
  isNavItemActive,
  isMainNavItemActive,
} from "./navItems";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useBreakpoints } from "@/hooks";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { useTranslation } from "@/lib/i18n";
import { isProductFeatureEnabled } from "@/lib/productFeatures";

const CHAT_HREF = "/dashboard/chat";

interface AppSidebarProps {
  onNavigate?: () => void;
}

function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const { state, toggleSidebar, isInitialized, setOpenMobile } = useSidebar();
  const { profile } = useUserProfileContext();
  const { t } = useTranslation();
  const c = useCopy();
  const { openAsk, canAsk } = useDecisionCommand();
  const [isMounted, setIsMounted] = useState(false);
  const { isMobile, isTablet } = useBreakpoints();

  const isAdmin = profile?.is_admin ?? false;

  const enabledItems = MAIN_NAV_ITEMS.filter((item) => isProductFeatureEnabled(item.featureId));
  const chat = enabledItems.find((item) => item.href === CHAT_HREF);
  const chatActive = isNavItemActive(pathname, CHAT_HREF);

  // AI Chat lives in the header; group the remaining routes in the scroller.
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    title: t(group.titleKey),
    items: enabledItems
      .filter((item) => item.group === group.id && item.href !== CHAT_HREF)
      .map((item) => ({ ...item, title: t(item.titleKey) })),
  })).filter((group) => group.items.length > 0);

  const footerLinks = [
    ...(isAdmin
      ? [{ icon: ShieldCheck, title: t("sidebar.admin"), href: "/dashboard/admin" }]
      : []),
    { icon: Settings, title: t("sidebar.settings"), href: "/dashboard/settings" },
  ];

  const handleNavigate = () => {
    setOpenMobile(false);
    onNavigate?.();
  };

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isActive = (href: string) => isNavItemActive(pathname, href);

  return (
    <SidebarPrimitive
      variant="sidebar"
      collapsible="icon"
      className="app-sidebar border-r border-border/70"
    >
      {/* Fixed top: brand, collapse toggle, and global entry points. */}
      <SidebarHeader className="gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full"
            onClick={handleNavigate}
          >
            <KolvexWordmark height={18} className="group-data-[collapsible=icon]:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element -- static square app icon for the collapsed rail */}
            <img
              src="/brand/kolvex-icon-small.png"
              alt="Kolvex"
              width={32}
              height={32}
              className="hidden size-8 rounded-md group-data-[collapsible=icon]:block"
            />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden h-8 w-8 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground lg:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center"
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

        <SidebarMenu>
          {chat && (
            <SidebarMenuItem>
              <Link
                href={chat.href}
                onClick={handleNavigate}
                aria-current={chatActive ? "page" : undefined}
                title={state === "collapsed" ? t(chat.titleKey) : undefined}
                className="sidebar-chat-cta flex h-11 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:rounded-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
              >
                <chat.icon
                  aria-hidden="true"
                  className="sidebar-chat-icon size-[1.125rem] shrink-0"
                />
                <span className="min-w-0 truncate group-data-[collapsible=icon]:sr-only">
                  {t(chat.titleKey)}
                </span>
                {chatActive ? (
                  <span
                    aria-hidden="true"
                    className="sidebar-chat-live ml-auto shrink-0 group-data-[collapsible=icon]:hidden"
                  />
                ) : (
                  <ArrowRight
                    aria-hidden="true"
                    className="sidebar-chat-arrow ml-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden"
                  />
                )}
              </Link>
            </SidebarMenuItem>
          )}
          {canAsk && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  handleNavigate();
                  openAsk();
                }}
                tooltip={c("Ask Kolvex", "询问 Kolvex")}
                className="border border-border/70 bg-background/60 hover:border-foreground/25 group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent"
              >
                <MessageSquareText />
                <span className="flex-1">{c("Ask Kolvex…", "询问 Kolvex…")}</span>
                <kbd className="rounded border border-border px-1 font-sans text-[0.625rem] leading-4 text-muted-foreground group-data-[collapsible=icon]:hidden">
                  ⌘K
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive(SEARCH_HREF)}
              onClick={handleNavigate}
              tooltip={c("Search", "探索")}
            >
              <Link href={SEARCH_HREF} aria-current={isActive(SEARCH_HREF) ? "page" : undefined}>
                <Search aria-hidden="true" />
                <span>{c("Search", "探索")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Scrolling middle: scenario groups. Spacing, not lines, separates them. */}
      <SidebarContent className="gap-6 py-4 group-data-[collapsible=icon]:gap-3">
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel className="mb-1 h-6 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isMainNavItemActive(pathname, item);
                  const hasChildren = Boolean(item.children);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        // A parent with sub-links marks its section, not the page:
                        // the child row carries the highlight so only one row is filled.
                        isActive={!hasChildren && active}
                        data-section-active={hasChildren && active ? "true" : undefined}
                        onClick={handleNavigate}
                        tooltip={item.title}
                      >
                        <Link
                          href={item.href}
                          aria-current={!hasChildren && active ? "page" : undefined}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.children && (
                        <SidebarMenuSub
                          className="ml-5 mt-1 border-l border-border/50 pl-3"
                          aria-label={item.title}
                        >
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActive(child.href)}
                                onClick={handleNavigate}
                              >
                                <Link
                                  href={child.href}
                                  aria-current={isActive(child.href) ? "page" : undefined}
                                >
                                  <child.icon aria-hidden="true" />
                                  <span>{child.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Fixed bottom: utilities, then the account menu. Upgrade and Help
          (UPGRADE_HREF / HELP_HREF) are hidden until pricing and a help centre exist. */}
      <SidebarFooter className="gap-3 border-t border-border/40 pt-3">
        <SidebarMenu>
          {footerLinks.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.href)}
                onClick={handleNavigate}
                tooltip={item.title}
              >
                <Link href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                  <item.icon aria-hidden="true" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <UserMenu
          isCollapsed={
            isMounted && isInitialized && state === "collapsed" && !isMobile && !isTablet
          }
        />
      </SidebarFooter>
    </SidebarPrimitive>
  );
}

export default AppSidebar;
