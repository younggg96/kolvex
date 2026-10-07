"use client";

import Link from "next/link";
import { Github, Mail } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function Footer() {
  const { locale } = useTranslation();
  const zh = locale === "zh";
  return <footer className="border-t border-border py-8"><div className="landing-width flex flex-wrap items-center justify-between gap-6">
    <span className="text-sm font-semibold">Kolvex <span className="ml-3 font-normal text-muted-foreground">© {new Date().getFullYear()}</span></span>
    <nav aria-label={zh ? "页脚导航" : "Footer"} className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
      <Link href="/privacy" className="hover:text-foreground">{zh ? "隐私政策" : "Privacy"}</Link>
      <Link href="/terms" className="hover:text-foreground">{zh ? "服务条款" : "Terms"}</Link>
      <Link href="/contact" className="hover:text-foreground">{zh ? "联系我们" : "Contact"}</Link>
      <a href="mailto:support@kolvex.app" aria-label="Email Kolvex" title="Email Kolvex"><Mail className="h-4 w-4" /></a>
      <a href="https://github.com/younggg96/kolvex" aria-label="Kolvex on GitHub" title="Kolvex on GitHub"><Github className="h-4 w-4" /></a>
    </nav>
  </div></footer>;
}
