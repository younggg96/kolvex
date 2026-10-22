"use client";

import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import BaseLayout from "@/components/layout/BaseLayout";
import LandingHero from "@/components/landing/LandingHero";
import LandingIntelligence from "@/components/landing/LandingIntelligence";
import LandingScrollEffects from "@/components/landing/LandingScrollEffects";
import LandingCTA from "@/components/landing/LandingCTA";
import "@/components/landing/landing.css";

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
      const element = document.getElementById(
        decodeURIComponent(anchor.hash.slice(1)),
      );
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
    <div className="landing-page" lang={locale === "zh" ? "zh-CN" : "en"}>
      <LandingScrollEffects />
      <BaseLayout>
        <LandingHero />
        <LandingIntelligence />
        <LandingCTA />
      </BaseLayout>
    </div>
  );
}
