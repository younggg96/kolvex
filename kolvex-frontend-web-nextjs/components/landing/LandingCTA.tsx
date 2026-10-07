"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export default function LandingCTA() {
  const { t } = useTranslation();
  return <section className="bg-background py-12 md:py-16"><ScrollReveal delay={100} className="landing-width flex flex-col justify-between gap-6 md:flex-row md:items-center">
    <h2 className="max-w-xl font-display text-3xl font-bold">{t("landing.closing.title")}</h2>
    <Button asChild size="lg"><Link href="/auth">{t("landing.closing.open")}<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>
  </ScrollReveal></section>;
}
