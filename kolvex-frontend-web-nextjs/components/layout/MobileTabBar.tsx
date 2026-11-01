"use client";

import Link from "next/link";
import { Globe2, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useCopy } from "@/components/decision/shared";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { isProductFeatureEnabled } from "@/lib/productFeatures";
import { cn } from "@/lib/utils";
import { MAIN_NAV_ITEMS, isMainNavItemActive } from "./navItems";

export default function MobileTabBar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const c = useCopy();
  const { toggleSidebar, openMobile } = useSidebar();
  const items = MAIN_NAV_ITEMS.filter(
    (item) => isProductFeatureEnabled(item.featureId) &&
      ["home", "watchlist", "tradingAnalysis"].includes(item.featureId),
  );
  const targetClass = "mobile-nav-item flex h-11 min-w-11 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary-text focus-visible:bg-primary/10 focus-visible:text-primary-text active:bg-primary/[0.16] motion-reduce:transition-none";

  return (
    <nav
      aria-label={c("Main navigation", "主导航")}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
    >
      <div className="mx-auto w-full max-w-md">
        <ul className="mobile-nav-glass pointer-events-auto flex h-14 w-full items-center rounded-full p-1">
          {items.map((item) => {
            const active = isMainNavItemActive(pathname, item);
            const Icon = item.featureId === "home" ? Globe2 : item.icon;
            return (
              <li className="min-w-0 flex-1" key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={t(item.shortTitleKey)}
                  title={t(item.shortTitleKey)}
                  className={cn(targetClass, active && "bg-foreground/10 text-primary-text active:bg-foreground/10")}
                >
                  <Icon aria-hidden className={cn("h-[22px] w-[22px]", active && "text-primary")} strokeWidth={active ? 2 : 1.75} />
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-expanded={openMobile}
              aria-label={c("Open navigation menu", "打开导航菜单")}
              title={c("Menu", "菜单")}
              className={cn(targetClass, "w-full", openMobile && "bg-foreground/10 text-primary-text")}
            >
              <Menu aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.75} />
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
