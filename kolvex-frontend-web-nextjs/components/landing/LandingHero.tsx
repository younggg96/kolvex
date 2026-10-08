"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import LandingPreview from "@/components/landing/LandingPreview";
import { useTranslation } from "@/lib/i18n";

export default function LandingHero() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <div className="landing-width relative z-10 py-12 text-center md:py-16">
        <h1 className="mx-auto max-w-4xl font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">{t("landing.workspaceHero.headline")}</h1>
        <p className="rh-enter rh-enter-delay mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("landing.workspaceHero.subheadline")}
        </p>
        <div className="rh-enter rh-enter-late mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link href="/auth">{t("landing.workspaceHero.openWorkspace")}<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button asChild variant="outline" size="lg"><Link href="#decision-preview">{t("landing.workspaceHero.exploreWorkflow")}</Link></Button>
        </div>

      </div>
      <LandingPreview />
    </section>
  );
}
