"use client";

import { useEffect } from "react";
import BaseLayout from "@/components/layout/BaseLayout";
import { useTranslation } from "@/lib/i18n";

export default function ContactPageContent() {
  const { t } = useTranslation();
  const title = t("contact.title");

  useEffect(() => {
    document.title = `${title} | Kolvex`;
  }, [title]);

  return (
    <BaseLayout>
      <div className="mx-auto w-full max-w-3xl px-4 py-12 md:px-8">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">{title}</h1>
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="mb-3 text-sm text-muted-foreground">{t("contact.support")}</p>
          <a
            href="mailto:support@kolvex.app"
            className="break-all font-medium underline underline-offset-4"
          >
            support@kolvex.app
          </a>
        </div>
      </div>
    </BaseLayout>
  );
}
