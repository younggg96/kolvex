"use client";

import Link from "next/link";
import BaseLayout from "@/components/layout/BaseLayout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <BaseLayout>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-12 md:px-8">
        <h1 className="text-3xl font-bold">{t("common.pageNotFound")}</h1>
        <Button asChild variant="outline">
          <Link href="/">{t("common.backHome")}</Link>
        </Button>
      </div>
    </BaseLayout>
  );
}
