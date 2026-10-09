"use client";

import { useEffect, type ReactNode } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useTranslation } from "@/lib/i18n";

interface ResearchLayoutProps {
  children: ReactNode;
  headerActions?: ReactNode;
}

export default function ResearchLayout({
  children,
  headerActions,
}: ResearchLayoutProps) {
  const { t } = useTranslation();
  const title = t("tradingAnalysis.title");

  useEffect(() => {
    document.title = `${title} — Kolvex`;
  }, [title]);

  return (
    <DashboardLayout title={title} headerActions={headerActions}>
      {children}
    </DashboardLayout>
  );
}
