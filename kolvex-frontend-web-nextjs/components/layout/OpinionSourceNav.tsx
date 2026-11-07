"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { OPINION_SOURCES, isNavItemActive } from "./navItems";
import type { HeaderBackTarget } from "./headerBack";

/**
 * Phone-only source switcher that floats over the top of the page. The bar is
 * transparent; the glass back button (on sub-pages) and the left-aligned glass
 * segmented control are its only surfaces. The page's first region is inset
 * by `--opinion-header-height` (see globals.css) so nothing starts hidden.
 */
export function useOpinionHeaderActive() {
  const pathname = usePathname();
  return OPINION_SOURCES.some((source) => isNavItemActive(pathname, source.href));
}

const backClass = "pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-foreground glass-track glass-track-strong transition-colors active:bg-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25";

export default function OpinionSourceNav({ back }: { back?: HeaderBackTarget | null }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const active = useOpinionHeaderActive();
  if (!active) return null;
  const backLabel = back && `${t("common.back")} · ${back.label}`;

  return (
    <div data-opinion-header className="opinion-header pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-start gap-2 px-[16px] lg:hidden">
      {back?.href ? <Link href={back.href} aria-label={backLabel!} title={backLabel!} className={backClass}><ChevronLeft className="h-5 w-5" aria-hidden="true" /></Link>
        : back?.onClick ? <button type="button" onClick={back.onClick} aria-label={backLabel!} title={backLabel!} className={backClass}><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button> : null}
      <nav aria-label={t("sidebar.youtubeOpinions")} className="pointer-events-auto flex max-w-full gap-0.5 rounded-full p-1 glass-track glass-track-strong">
        {OPINION_SOURCES.map((source) => {
          const active = isNavItemActive(pathname, source.href);
          return (
            <Link key={source.href} href={source.href} aria-current={active ? "page" : undefined}
              className={cn("flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold tracking-[-0.01em] transition-[background-color,color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
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
