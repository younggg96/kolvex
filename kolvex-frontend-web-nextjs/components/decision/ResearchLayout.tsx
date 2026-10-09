"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { Telescope, Youtube } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useTranslation } from "@/lib/i18n";
import { DEEP_RESEARCH_PATH, RESEARCH_PATH } from "@/lib/researchRoutes";
import { cn } from "@/lib/utils";

interface ResearchLayoutProps {
  children: ReactNode;
  activeView: "creators" | "deep-research";
  headerActions?: ReactNode;
}

export default function ResearchLayout({
  children,
  activeView,
  headerActions,
}: ResearchLayoutProps) {
  const { t } = useTranslation();
  const views = [
    { id: "creators", href: RESEARCH_PATH, label: t("research.creatorOpinions"), icon: Youtube },
    { id: "deep-research", href: DEEP_RESEARCH_PATH, label: t("tradingAnalysis.title"), icon: Telescope },
  ];
  const title = activeView === "deep-research"
    ? `${t("tradingAnalysis.title")} · ${t("sidebar.research")}`
    : t("sidebar.research");

  useEffect(() => {
    document.title = `${title} — Kolvex`;
  }, [title]);

  return (
    <DashboardLayout title={t("sidebar.research")} headerActions={headerActions}>
      <nav aria-label={t("research.navigation")} className="shrink-0 px-4 pt-2 md:px-8">
        <div className="flex gap-6 border-b border-border">
          {views.map(({ id, href, label, icon: Icon }) => (
            <Link
              key={id}
              href={href}
              aria-current={activeView === id ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-12 cursor-pointer items-center gap-2 border-b-2 px-1 text-sm font-semibold transition-colors duration-150 hover:text-foreground active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                activeView === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </DashboardLayout>
  );
}
