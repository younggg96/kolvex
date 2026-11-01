"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe2, Menu, Search } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCopy } from "@/components/decision/shared";
import StockLookup from "@/components/decision/StockLookup";
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
  const [searchOpen, setSearchOpen] = useState(false);
  const items = MAIN_NAV_ITEMS.filter(
    (item) => isProductFeatureEnabled(item.featureId) &&
      ["home", "watchlist", "tradingAnalysis"].includes(item.featureId),
  );
  const targetClass = "flex h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground active:bg-foreground/10 motion-reduce:transition-none";

  return (
    <nav
      aria-label={c("Main navigation", "主导航")}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
    >
      <div className="mx-auto flex w-full max-w-md items-center gap-2.5">
        <ul className="pointer-events-auto flex h-14 min-w-0 flex-1 items-center rounded-full border border-border bg-card p-1 dark:bg-secondary">
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
                  className={cn(targetClass, active && "bg-foreground/10 text-foreground")}
                >
                  <Icon aria-hidden className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.75} />
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
              className={cn(targetClass, "w-full", openMobile && "bg-foreground/10 text-foreground")}
            >
              <Menu aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.75} />
            </button>
          </li>
        </ul>
        <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label={c("Search stocks", "搜索股票")}
              title={c("Search stocks", "搜索股票")}
              className={cn(targetClass, "pointer-events-auto h-14 w-14 shrink-0 border border-border bg-card text-foreground dark:bg-secondary")}
            >
              <Search aria-hidden className="h-[23px] w-[23px]" strokeWidth={1.75} />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" closeLabel={c("Close search", "关闭搜索")} aria-describedby={undefined} className="rounded-t-2xl">
            <div className="mx-auto max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
              <SheetTitle className="mb-5 pr-8">{c("Search stocks", "搜索股票")}</SheetTitle>
              <StockLookup onNavigate={() => setSearchOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
