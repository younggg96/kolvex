"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { OPINION_SOURCES, isNavItemActive } from "./navItems";

export default function OpinionSourceNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  if (!OPINION_SOURCES.some((source) => isNavItemActive(pathname, source.href))) return null;

  return (
    <nav aria-label={t("sidebar.youtubeOpinions")} className="flex shrink-0 gap-5 border-b border-border bg-sidebar px-4 lg:hidden">
      {OPINION_SOURCES.map((source) => {
        const active = isNavItemActive(pathname, source.href);
        return (
          <Link key={source.href} href={source.href} aria-current={active ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-2 border-b-2 px-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <source.icon className="h-4 w-4" aria-hidden="true" />
            {source.title}
          </Link>
        );
      })}
    </nav>
  );
}
