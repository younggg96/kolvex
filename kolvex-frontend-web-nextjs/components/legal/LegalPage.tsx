"use client";

import { useEffect, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import BaseLayout from "@/components/layout/BaseLayout";
import { useTranslation } from "@/lib/i18n";

export function LegalPage({
  kind,
  chinese,
  children,
}: {
  kind: "privacy" | "terms";
  chinese: string;
  children: ReactNode;
}) {
  const { locale, t } = useTranslation();
  const title = t(`footer.${kind}`);
  useEffect(() => {
    document.title = `${title} | Kolvex`;
  }, [title]);
  return (
    <BaseLayout>
      <article className="prose prose-sm mx-auto w-full max-w-4xl break-words px-4 py-12 text-foreground dark:prose-invert sm:prose-base md:px-8">
        {locale === "zh" ? <ReactMarkdown>{chinese}</ReactMarkdown> : children}
      </article>
    </BaseLayout>
  );
}
