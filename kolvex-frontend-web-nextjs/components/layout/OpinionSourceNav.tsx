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
    <nav aria-label={t("sidebar.youtubeOpinions")} className="mx-4 mt-3 flex w-fit max-w-[calc(100%-2rem)] shrink-0 gap-1 overflow-x-auto rounded-full bg-muted/50 p-1 lg:hidden">
      {OPINION_SOURCES.map((source) => {
        const active = isNavItemActive(pathname, source.href);
        return (
          <Link key={source.href} href={source.href} aria-current={active ? "page" : undefined}
            className={cn("group/source flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:bg-foreground/[0.06]",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]")}>
            <source.icon
              className={cn(
                "h-4 w-4 transition-opacity duration-150",
                active
                  ? "text-background opacity-100"
                  : "text-foreground opacity-0 group-hover/source:opacity-100",
              )}
              aria-hidden="true"
            />
            {source.title}
          </Link>
        );
      })}
    </nav>
  );
}
