"use client";

import { useTranslation } from "@/lib/i18n";
import { StrengthIndicator } from "./StrengthIndicator";

/** Direction and magnitude as words; numeric scores stay hidden. */
export default function OpinionStrength(props: { value?: number | null; change?: boolean; className?: string }) {
  const { t } = useTranslation();
  return <StrengthIndicator {...props} t={t} />;
}
