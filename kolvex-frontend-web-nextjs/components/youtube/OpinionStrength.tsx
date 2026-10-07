"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { describeStrength, toneFill, toneText } from "./strength";

/** Direction and magnitude as words plus a three-step meter; numeric scores stay hidden. */
export default function OpinionStrength({
  value,
  change = false,
  className,
}: {
  value?: number | null;
  change?: boolean;
  className?: string;
}) {
  const { locale } = useTranslation();
  const strength = describeStrength(value, { zh: locale === "zh", change });

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 text-sm font-semibold",
        toneText[strength.tone],
        className,
      )}
    >
      <span aria-hidden="true" className="flex shrink-0 items-end gap-[3px]">
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn(
              "w-[3px] rounded-full",
              step <= strength.level ? toneFill[strength.tone] : "bg-foreground/15",
            )}
            style={{ height: 4 + step * 3 }}
          />
        ))}
      </span>
      <span className="truncate">{strength.label}</span>
    </span>
  );
}
