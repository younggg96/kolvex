"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTranslation } from "@/lib/i18n";
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

/** Pages portal phone-only header actions (e.g. "View market data") into this slot. */
export const OPINION_HEADER_ACTIONS_ID = "opinion-header-actions";

/** The header actions slot while the phone header is showing, else null (render inline). */
export function useOpinionHeaderActionsSlot() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 1023px)");
    const sync = () => setSlot(phone.matches ? document.getElementById(OPINION_HEADER_ACTIONS_ID) : null);
    sync();
    phone.addEventListener("change", sync);
    return () => phone.removeEventListener("change", sync);
  }, []);
  return slot;
}

/** Glass pill matching the header's back button, for actions placed in the header slot. */
export const opinionHeaderActionClass = "pointer-events-auto inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-foreground glass-track glass-track-strong transition-colors active:bg-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25";

const backClass = "pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-foreground glass-track glass-track-strong transition-colors active:bg-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25";

export default function OpinionSourceNav({ back }: { back?: HeaderBackTarget | null }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const router = useRouter();
  const active = useOpinionHeaderActive();
  if (!active) return null;
  const activeHref = OPINION_SOURCES.find((source) => isNavItemActive(pathname, source.href))?.href ?? null;
  // Sub-pages (a stock, a creator; often just `?stock=` on the same path) register a back
  // target. They keep only the back button; the source switcher belongs to the list pages.
  const onSourceRoot = !back;
  const backLabel = back && `${t("common.back")} · ${back.label}`;

  return (
    <div data-opinion-header className="opinion-header pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-start gap-2 px-[16px] lg:hidden">
      {back?.href ? <Link href={back.href} aria-label={backLabel!} title={backLabel!} className={backClass}><ChevronLeft className="h-5 w-5" aria-hidden="true" /></Link>
        : back?.onClick ? <button type="button" onClick={back.onClick} aria-label={backLabel!} title={backLabel!} className={backClass}><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button> : null}
      {onSourceRoot && <SegmentedControl
        semantics="nav"
        label={t("sidebar.youtubeOpinions")}
        className="pointer-events-auto min-h-12 gap-1 p-1"
        itemClassName="!min-h-10 !px-4 !text-[0.9375rem]"
        value={activeHref}
        onChange={(href) => {
          if (href !== activeHref) router.push(href);
        }}
        options={OPINION_SOURCES.map((source) => ({
          value: source.href,
          ariaLabel: source.title,
          label: <><source.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{source.title}</span></>,
        }))}
      />}
      <div id={OPINION_HEADER_ACTIONS_ID} className="pointer-events-none ml-auto flex items-center gap-2 empty:hidden" />
    </div>
  );
}
