"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useCopy } from "@/components/decision/shared";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { isProductFeatureEnabled } from "@/lib/productFeatures";
import { cn } from "@/lib/utils";
import { MAIN_NAV_ITEMS, isNavItemActive } from "./navItems";

export default function MobileTabBar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const c = useCopy();
  const { toggleSidebar, openMobile } = useSidebar();
  const items = MAIN_NAV_ITEMS.filter(
    (item) =>
      isProductFeatureEnabled(item.featureId) &&
      item.featureId !== "portfolio",
  );

  return (
    <nav
      aria-label="Kolvex"
      className="shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        <li>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={openMobile}
            aria-label={c("Open navigation menu", "打开导航菜单")}
            className="flex h-14 w-full flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <Menu aria-hidden className="h-[22px] w-[22px]" />
            <span className="text-[10px] leading-3 sm:text-[11px]">{c("Menu", "菜单")}</span>
          </button>
        </li>
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <item.icon
                  className="h-[22px] w-[22px]"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="max-w-full px-1 text-center text-[10px] leading-3 sm:text-[11px]">{t(item.shortTitleKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
