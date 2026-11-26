import { decisionLabel, decisionTone } from "../lib/decision";
import { useTheme } from "../lib/theme";
import { Copy } from "./UI";

/** A research rating or technical bias as a fixed, coloured label (看多 / 看空 / 中性). */
export function Direction({
  value,
  bias = false,
  size = 14,
}: {
  value?: string | null;
  bias?: boolean;
  size?: number;
}) {
  const t = useTheme();
  if (!value && bias) return null;
  const tone = decisionTone(value);
  return (
    <Copy
      size={size}
      bold={!!value}
      color={
        tone === null
          ? t.secondary
          : tone === "positive"
            ? t.accent
            : tone === "negative"
              ? t.negative
              : t.text
      }
    >
      {decisionLabel(value, bias)}
    </Copy>
  );
}
