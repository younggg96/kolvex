"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

export function LegalLocaleSwitch({
  kind,
  zh,
  children,
}: {
  kind: "privacy" | "terms";
  zh: ReactNode;
  children: ReactNode;
}) {
  const { locale, t } = useTranslation();
  const title = t(`footer.${kind}`);
  useEffect(() => {
    document.title = `${title} | Kolvex`;
  }, [title]);
  return <>{locale === "zh" ? zh : children}</>;
}
