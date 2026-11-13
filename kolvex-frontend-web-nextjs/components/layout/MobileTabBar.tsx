"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Globe2, LogOut, Menu, Search, Settings, ShieldCheck } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { useAuth } from "@/hooks";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { isProductFeatureEnabled } from "@/lib/productFeatures";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { MAIN_NAV_ITEMS, SEARCH_HREF, isMainNavItemActive, isNavItemActive } from "./navItems";

/** Dock tabs, left to right; everything else lives in the menu. */
const DOCK_TAB_HREFS = ["/dashboard/chat", "/dashboard", "/dashboard/youtube-opinions"];
/** Rounding and iOS rubber-banding can leave a scroller just short of its exact end. */
const SCROLL_END_TOLERANCE_PX = 2;
/** Option value for the dock's menu toggle. */
const MENU_VALUE = "__menu";

/**
 * Reports whether the page scroller last moved vertically is between its top and bottom.
 * Horizontal tables and charts don't count, and each route starts back at the top.
 */
function useIsMidScroll(pathname: string, onScroll: () => void) {
  const [midScroll, setMidScroll] = useState(false);
  const latestOnScroll = useRef(onScroll);
  latestOnScroll.current = onScroll;

  useEffect(() => {
    setMidScroll(false);
  }, [pathname]);

  useEffect(() => {
    const positions = new WeakMap<Element, number>();
    const handleScroll = (event: Event) => {
      // Document scrolls and portaled popups are excluded: iOS pans the document when
      // the keyboard opens, and a closed popup could never report reaching its end.
      if (!(event.target instanceof Element) || !event.target.closest(".mobile-nav-inset") || event.target.closest("[data-mobile-dock]")) return;
      const { scrollTop, scrollHeight, clientHeight } = event.target;
      const moved = scrollTop !== (positions.get(event.target) ?? 0);
      positions.set(event.target, scrollTop);
      if (!moved) return;
      latestOnScroll.current();
      setMidScroll(
        scrollTop > SCROLL_END_TOLERANCE_PX &&
          scrollTop + clientHeight < scrollHeight - SCROLL_END_TOLERANCE_PX,
      );
    };
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", handleScroll, { capture: true });
  }, []);

  return midScroll;
}

interface MobileTabBarProps {
  /** The page floats its own composer on the dock, so the shell skips reserving space for it. */
  compact?: boolean;
}

export default function MobileTabBar({ compact = false }: MobileTabBarProps) {
  const pathname = usePathname();
  // A page that docks its own composer (the new-chat page) releases the shell
  // inset AppShell reserves for the dock so the two can meet without a gap.
  useEffect(() => {
    if (!compact) return;
    document.documentElement.dataset.chatDocked = "";
    return () => {
      delete document.documentElement.dataset.chatDocked;
    };
  }, [compact]);
  const router = useRouter();
  const { t } = useTranslation();
  const c = useCopy();
  const { signOut } = useAuth();
  const { profile } = useUserProfileContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const dock = useRef<HTMLDivElement>(null);
  const panelContent = useRef<HTMLDivElement>(null);
  useIsMidScroll(pathname, () => setMenuOpen(false));
  const searchActive = isNavItemActive(pathname, SEARCH_HREF);

  const enabledItems = MAIN_NAV_ITEMS.filter((item) => isProductFeatureEnabled(item.featureId));
  const tabs = DOCK_TAB_HREFS.flatMap((href) => enabledItems.filter((item) => item.href === href));
  const activeDockHref = tabs.find((item) => isMainNavItemActive(pathname, item))?.href ?? (searchActive ? SEARCH_HREF : null);
  // An open menu is the dock's selected control; otherwise the current page is.
  const dockValue = menuOpen ? MENU_VALUE : activeDockHref;
  const menuLinks = [
    ...enabledItems
      .filter((item) => !DOCK_TAB_HREFS.includes(item.href))
      .map((item) => ({ href: item.href, title: t(item.shortTitleKey), icon: item.icon })),
    { href: "/dashboard/settings", title: t("sidebar.settings"), icon: Settings },
    ...(profile?.is_admin ? [{ href: "/dashboard/admin", title: t("sidebar.admin"), icon: ShieldCheck }] : []),
  ];

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !dock.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      dock.current?.querySelector<HTMLElement>("[data-slot=segmented-control] button:last-child")?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  function toggleMenu() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    // Mount the visible panel before moving focus. Its opening animation starts
    // at zero height while the dock also scales up: default focus scrolling can
    // pan an ancestor and trigger useIsMidScroll's close-on-scroll handler.
    flushSync(() => setMenuOpen(true));
    panelContent.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
  }

  async function handleLogout() {
    await signOut();
    router.push("/auth");
  }

  /* Dock affordances are neutral: hover/press use a grey wash and the current
     page simply goes full-contrast. Green stays reserved for direction data. */
  const iconClass = "h-[1.375rem] w-[1.375rem]";
  const menuItemClass = "mobile-nav-item flex min-h-[60px] w-full flex-col items-center justify-center gap-1 rounded-[20px] px-1 text-[12px] font-medium text-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:bg-foreground/[0.06] focus-visible:text-foreground focus-visible:outline-none active:bg-foreground/[0.1] motion-reduce:transition-none";

  return (
    <nav
      aria-label={c("Main navigation", "主导航")}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
    >
      <div
        ref={dock}
        data-mobile-dock
        className={cn(
          "glass-track glass-track-strong pointer-events-auto mx-auto w-full max-w-md rounded-3xl p-1 ring-1 ring-foreground/[0.06] !shadow-[0_10px_30px_-6px_rgb(0_0_0/0.30),0_2px_8px_rgb(0_0_0/0.10)]",
        )}
      >
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
            menuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              ref={panelContent}
              id="mobile-dock-panel"
              className={cn("p-1 pb-2", menuOpen ? "visible" : "invisible [transition:visibility_0s_200ms]")}
            >
              <ul className="grid grid-cols-3 gap-1">
                {menuLinks.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMenuOpen(false)}
                        className={cn(menuItemClass, active && "glass-thumb text-glass-thumb-foreground hover:text-glass-thumb-foreground")}
                      >
                        <item.icon aria-hidden className="h-[20px] w-[20px]" strokeWidth={active ? 2 : 1.75} />
                        <span className="max-w-full truncate">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <button type="button" onClick={handleLogout} className={cn(menuItemClass, "text-negative hover:text-negative focus-visible:text-negative")}>
                    <LogOut aria-hidden className="h-[20px] w-[20px]" strokeWidth={1.75} />
                    <span className="max-w-full truncate">{t("userMenu.logOut")}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <SegmentedControl
          bare
          semantics="nav"
          label={c("Main navigation", "主导航")}
          className="flex w-full"
          itemClassName="h-11 min-h-11 flex-1 shrink px-0"
          value={dockValue}
          onChange={(next) => {
            if (next === MENU_VALUE) {
              toggleMenu();
              return;
            }
            setMenuOpen(false);
            if (next !== activeDockHref) router.push(next);
          }}
          options={[
            ...tabs.map((item) => {
              const Icon = item.featureId === "home" ? Globe2 : item.icon;
              const on = dockValue === item.href;
              return {
                value: item.href,
                ariaLabel: t(item.shortTitleKey),
                title: t(item.shortTitleKey),
                label: <Icon aria-hidden className={iconClass} strokeWidth={on ? 2 : 1.75} />,
              };
            }),
            {
              value: SEARCH_HREF,
              ariaLabel: c("Search", "探索"),
              title: c("Search", "探索"),
              label: <Search aria-hidden className={iconClass} strokeWidth={dockValue === SEARCH_HREF ? 2 : 1.75} />,
            },
            {
              value: MENU_VALUE,
              ariaLabel: c("Open navigation menu", "打开导航菜单"),
              title: c("Menu", "菜单"),
              label: <Menu aria-hidden className={iconClass} strokeWidth={menuOpen ? 2 : 1.75} />,
            },
          ]}
        />
      </div>
    </nav>
  );
}
