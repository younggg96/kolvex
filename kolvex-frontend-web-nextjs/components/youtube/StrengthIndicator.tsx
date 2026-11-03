import { cn } from "@/lib/utils";
import { describeStrength, toneFill, toneText } from "./strength";

/**
 * Shared server-compatible view; locale is supplied by its owning surface.
 *
 * `barsOnly` drops the words in favour of the level bars and a direction
 * arrow, for narrow rails where the label would overflow. The words stay
 * available to assistive technology, so the reading is never lost.
 */
export function StrengthIndicator({ value, change = false, className, t, barsOnly = false }: {
  value?: number | null;
  change?: boolean;
  className?: string;
  t: (key: string, params?: Record<string, string>) => string;
  barsOnly?: boolean;
}) {
  const strength = describeStrength(value, { t, change });
  const bars = <span aria-hidden="true" className="flex shrink-0 items-end gap-[0.1875rem]">{[1, 2, 3].map((step) => <span key={step} className={cn("w-[0.1875rem] rounded-full", step <= strength.level ? toneFill[strength.tone] : "bg-foreground/15")} style={{ height: 4 + step * 3 }} />)}</span>;
  if (barsOnly) {
    return <span className={cn("inline-flex max-w-full items-center gap-1 text-sm font-semibold", toneText[strength.tone], className)}>
      <span className="sr-only">{strength.label}</span>
      {bars}
      {strength.tone !== "neutral" && <span aria-hidden="true" className="text-[0.6875rem] leading-none">{strength.tone === "positive" ? "↑" : "↓"}</span>}
    </span>;
  }
  return <span className={cn("inline-flex max-w-full items-center gap-2 text-sm font-semibold", toneText[strength.tone], className)}>
    {bars}
    <span className="truncate">{strength.label}</span>
  </span>;
}
