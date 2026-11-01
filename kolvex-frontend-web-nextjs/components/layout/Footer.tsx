"use client";

import Link from "next/link";
import { Github, Mail } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function Footer() {
  const { t } = useTranslation();
  return <footer className="border-t border-border py-8"><div className="landing-width flex flex-wrap items-center justify-between gap-6">
    <span className="text-sm font-semibold">Kolvex <span className="ml-3 font-normal text-muted-foreground">© {new Date().getFullYear()}</span></span>
    <nav aria-label={t("footer.nav")} className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
      <Link href="/research" className="transition-colors hover:text-primary-text">{t("sidebar.tradingAnalysis")}</Link>
      <Link href="/creators" className="transition-colors hover:text-primary-text">{t("landing.nav.creatorResearch")}</Link>
      <Link href="/privacy" className="transition-colors hover:text-primary-text">{t("footer.privacy")}</Link>
      <Link href="/terms" className="transition-colors hover:text-primary-text">{t("footer.terms")}</Link>
      <Link href="/contact" className="transition-colors hover:text-primary-text">{t("footer.contact")}</Link>
      <a href="mailto:support@kolvex.app" aria-label="Email Kolvex" title="Email Kolvex" className="rounded-full transition-colors hover:text-primary-text"><Mail className="h-4 w-4" /></a>
      <a href="https://github.com/younggg96/kolvex" aria-label="Kolvex on GitHub" title="Kolvex on GitHub" className="rounded-full transition-colors hover:text-primary-text"><Github className="h-4 w-4" /></a>
    </nav>
  </div></footer>;
}
