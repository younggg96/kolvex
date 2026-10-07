"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { isProductFeatureEnabled } from "@/lib/productFeatures";
import { cn } from "@/lib/utils";
import { MAIN_NAV_ITEMS, isNavItemActive } from "./navItems";

export default function MobileTabBar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const items = MAIN_NAV_ITEMS.filter((item) =>
    isProductFeatureEnabled(item.featureId),
  );

  return (
    <nav
      aria-label="Kolvex"
      className="shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
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
                <span>{t(item.shortTitleKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
