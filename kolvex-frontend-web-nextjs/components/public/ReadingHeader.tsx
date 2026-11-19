"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoIcon from "@/components/common/LogoIcon";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { useCopy } from "@/components/decision/shared";
import { SUPPORTED_LOCALES, useTranslation } from "@/lib/i18n";
import { isProductFeatureEnabled } from "@/lib/productFeatures";
import { cn } from "@/lib/utils";

const readingLocales = [...SUPPORTED_LOCALES].reverse();

const links = [
  { href: "/research", en: "Stock research", zh: "股票研究" },
  { href: "/creators", en: "Creator opinions", zh: "博主观点" },
  { href: "/stocks", en: "Stock directory", zh: "股票目录" },
  ...(isProductFeatureEnabled("personUpdates")
    ? [{ href: "/tracker", en: "Updates", zh: "动态" }]
    : []),
];

export function ReadingHeader() {
  const pathname = usePathname();
  const c = useCopy();
  const { locale, setLocale } = useTranslation();
  return (
    <header className="reading-header glass-header sticky top-0 z-40 border-b">
      <div className="mx-auto flex min-h-16 max-w-[70rem] items-center justify-between gap-2 px-[16px] py-2.5 md:px-8">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-2 rounded-sm text-xl font-extrabold focus-visible:outline-none"
        >
          <LogoIcon size={26} />
          Kolvex
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <div
            role="group"
            aria-label={c("Reading language", "阅读语言")}
            className="flex items-center gap-1"
          >
            {readingLocales.map(({ value, nativeLabel }) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                size="sm"
                lang={value === "zh" ? "zh-CN" : "en"}
                aria-pressed={locale === value}
                className="min-h-11 px-2 text-xs aria-pressed:bg-foreground/[0.08] aria-pressed:text-foreground"
                onClick={() => setLocale(value)}
              >
                {nativeLabel}
              </Button>
            ))}
          </div>
          <ThemeToggle
            labels={{
              light: c("Switch to light mode", "切换到浅色模式"),
              dark: c("Switch to dark mode", "切换到深色模式"),
            }}
          />
          <Button asChild variant="outline" size="sm">
            <Link href="/auth" aria-label={c("Open workspace", "打开工作台")}>
              <span className="sm:hidden">{c("Workspace", "工作台")}</span>
              <span className="hidden sm:inline">{c("Open workspace", "打开工作台")}</span>
            </Link>
          </Button>
        </div>
      </div>
      <nav
        aria-label={c("Public reading", "公开阅读")}
        className="mx-auto flex max-w-[70rem] flex-wrap gap-1 px-[16px] pb-3 md:px-8"
      >
        {links.map(({ href, en, zh }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === "/creators" && pathname.startsWith("/share/creators/"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "reading-nav-link inline-flex min-h-11 items-center rounded-full px-2 text-sm sm:px-4 font-semibold transition-colors focus-visible:outline-none",
                active
                  ? "glass-thumb text-foreground"
                  : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]",
              )}
            >
              {c(en, zh)}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
