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
    <nav aria-label={t("sidebar.youtubeOpinions")} className="mx-4 my-3 flex w-fit max-w-[calc(100%-2rem)] shrink-0 gap-1 overflow-x-auto rounded-full p-1 glass-track lg:hidden">
      {OPINION_SOURCES.map((source) => {
        const active = isNavItemActive(pathname, source.href);
        return (
          <Link key={source.href} href={source.href} aria-current={active ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:bg-foreground/[0.06]",
              active
                ? "glass-thumb text-foreground"
                : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]")}>
            <source.icon className="h-4 w-4" aria-hidden="true" />
            {source.title}
          </Link>
        );
      })}
    </nav>
  );
}
