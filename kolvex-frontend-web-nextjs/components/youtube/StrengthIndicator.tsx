import { cn } from "@/lib/utils";
import { describeStrength, toneFill, toneText } from "./strength";

/** Shared server-compatible view; locale is supplied by its owning surface. */
export function StrengthIndicator({ value, change = false, className, t }: {
  value?: number | null;
  change?: boolean;
  className?: string;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const strength = describeStrength(value, { t, change });
  return <span className={cn("inline-flex max-w-full items-center gap-2 text-sm font-semibold", toneText[strength.tone], className)}>
    <span aria-hidden="true" className="flex shrink-0 items-end gap-[3px]">{[1, 2, 3].map((step) => <span key={step} className={cn("w-[3px] rounded-full", step <= strength.level ? toneFill[strength.tone] : "bg-foreground/15")} style={{ height: 4 + step * 3 }} />)}</span>
    <span className="truncate">{strength.label}</span>
  </span>;
}
