"use client";

import Link from "next/link";
import { ArrowUpRight, Briefcase, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import LandingPreview from "@/components/landing/LandingPreview";
import { useTranslation } from "@/lib/i18n";

export default function LandingHero() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <div className="landing-width relative z-10 py-12 text-center md:py-16">
        <h1 className="rh-enter mx-auto max-w-3xl font-display text-6xl font-extrabold leading-none md:text-7xl">Kolvex</h1>
        <p className="rh-enter rh-enter-delay mx-auto mt-6 max-w-2xl text-xl font-normal leading-relaxed md:text-2xl">
          {t("landing.workspaceHero.headline")}
        </p>
        <p className="rh-enter rh-enter-delay mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("landing.workspaceHero.subheadline")}
        </p>
        <div className="rh-enter rh-enter-late mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link href="/auth">{t("landing.workspaceHero.openWorkspace")}<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button asChild variant="outline" size="lg"><Link href="#workflow">{t("landing.workspaceHero.exploreWorkflow")}</Link></Button>
        </div>
        <div className="rh-enter rh-enter-late mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2"><Youtube className="h-4 w-4 text-red-600" />{t("landing.workspaceHero.youtube")}</span>
          <span className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" />{t("landing.workspaceHero.portfolio")}</span>
        </div>
      </div>
      <LandingPreview />
    </section>
  );
}
