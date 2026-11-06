"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { OPINION_SOURCES, isNavItemActive } from "./navItems";

/**
 * Phone-only source switcher that floats over the top of the page, like an iOS
 * navigation bar: content scrolls beneath a scroll-edge blur, and the segmented
 * control stays centred below the status bar. The page's first region is inset
 * by `--opinion-header-height` (see globals.css) so nothing starts hidden.
 */
export default function OpinionSourceNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  if (!OPINION_SOURCES.some((source) => isNavItemActive(pathname, source.href))) return null;

  return (
    <div data-opinion-header className="opinion-header pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-4 lg:hidden">
      <nav aria-label={t("sidebar.youtubeOpinions")} className="pointer-events-auto flex w-full max-w-sm gap-0.5 rounded-full p-1 glass-track glass-track-strong">
        {OPINION_SOURCES.map((source) => {
          const active = isNavItemActive(pathname, source.href);
          return (
            <Link key={source.href} href={source.href} aria-current={active ? "page" : undefined}
              className={cn("flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold tracking-[-0.01em] transition-[background-color,color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
                active
                  ? "glass-thumb text-foreground"
                  : "text-muted-foreground active:bg-foreground/[0.08] active:text-foreground")}>
              <source.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{source.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
