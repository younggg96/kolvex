"use client";

import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import BaseLayout from "@/components/layout/BaseLayout";
import LandingBackground from "@/components/landing/LandingBackground";
import LandingHero from "@/components/landing/LandingHero";
import LandingIntelligence from "@/components/landing/LandingIntelligence";
import LandingScrollEffects from "@/components/landing/LandingScrollEffects";

/**
 * The landing page sits over a fixed backdrop, so BaseLayout's fill, grid and page entry are
 * turned off here. `landing-page` stays as the hook LandingScrollEffects looks for.
 * Every class is spelled out in full so Tailwind's scanner can find it.
 */
const landingPageClass = [
  "landing-page site-page-surface relative isolate bg-background text-foreground",
  // Glass fill behind small text where the dark-theme light band runs. No saturation boost:
  // it would push the green band through the glass.
  "[--landing-glass-fill:rgb(var(--card)/.86)] [--landing-glass-fill-hover:rgb(var(--interaction-hover))]",
  "dark:[--landing-glass-fill:rgb(6_12_8/.68)] dark:[--landing-glass-fill-hover:rgb(6_12_8/.78)]",
  "supports-[not_((backdrop-filter:blur(1px))_or_(-webkit-backdrop-filter:blur(1px)))]:[:root:not(.dark)_&]:[--landing-glass-fill:rgb(var(--background)/.9)]",
  "[&>.relative]:z-[1] [&>.relative]:min-h-dvh [&>.relative]:overflow-clip [&>.relative]:bg-transparent [&>div>.bg-grid]:hidden [&_main]:animate-none",
  // Wider gutters than the shared .landing-width outside the landing page.
  "min-[1001px]:[&_.landing-width]:w-[min(1200px,calc(100%-96px))] min-[641px]:max-[1001px]:[&_.landing-width]:w-[calc(100%-48px)] max-[641px]:[&_.landing-width]:w-[calc(100%-40px)]",
  "selection:bg-primary selection:text-primary-foreground",
  "[&_:is(a,button):focus-visible]:outline [&_:is(a,button):focus-visible]:outline-2 [&_:is(a,button):focus-visible]:outline-offset-[5px] [&_:is(a,button):focus-visible]:outline-positive",
  "[&_:is(section,#product):focus]:[outline:none]",
  "[:where(&)_a]:[transition:color_180ms_var(--spring),background-color_180ms_var(--spring)]",
  "motion-reduce:[&_*]:![animation:none] motion-reduce:[&_*]:![transition:none] motion-reduce:[&_*]:![scroll-behavior:auto]",
  "motion-reduce:[&_*::before]:![animation:none] motion-reduce:[&_*::before]:![transition:none] motion-reduce:[&_*::after]:![animation:none] motion-reduce:[&_*::after]:![transition:none]",
].join(" ");

export default function HomePageClient() {
  const { locale } = useTranslation();
  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a");
      if (
        !anchor?.hash ||
        anchor.origin !== window.location.origin ||
        anchor.pathname !== window.location.pathname
      )
        return;
      const element = document.getElementById(decodeURIComponent(anchor.hash.slice(1)));
      if (!element) return;
      event.preventDefault();
      window.history.pushState(null, "", anchor.hash);
      element.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      element.setAttribute("tabindex", "-1");
      element.focus({ preventScroll: true });
    };
    document.addEventListener("click", handleAnchorClick, true);
    return () => document.removeEventListener("click", handleAnchorClick, true);
  }, []);

  return (
    <div className={landingPageClass} lang={locale === "zh" ? "zh-CN" : "en"}>
      <LandingBackground />
      <LandingScrollEffects />
      <BaseLayout>
        <LandingHero />
        <LandingIntelligence />
      </BaseLayout>
    </div>
  );
}
