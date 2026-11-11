import { View } from "react-native";
import { describeStrength } from "../lib/opinionStrength";
import { useTheme } from "../lib/theme";
import { Copy } from "./UI";
/** Direction and magnitude as words; numeric scores stay hidden. */
export function OpinionStrength({
  value,
  change = false,
  size = 14,
  barsOnly = false,
}: {
  value?: number | null;
  change?: boolean;
  /** Label size; the Web's narrow rails use 12. */
  size?: number;
  /** The Web's barsOnly: bars and a direction arrow, the words kept for VoiceOver. */
  barsOnly?: boolean;
}) {
  const t = useTheme();
  const strength = describeStrength(value, change);
  const color =
    strength.tone === "positive"
      ? t.accent
      : strength.tone === "negative"
        ? t.negative
        : t.secondary;
  return (
    <View
      accessibilityLabel={barsOnly ? strength.label : undefined}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: barsOnly ? 4 : size < 14 ? 6 : 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
        {[1, 2, 3].map((step) => (
          <View
            key={step}
            style={{
              width: 3,
              height: 4 + step * 3,
              borderRadius: 2,
              backgroundColor: step <= strength.level ? color : t.border,
            }}
          />
        ))}
      </View>
      {barsOnly ? (
        strength.tone !== "neutral" && (
          <Copy size={11} bold color={color} localize={false}>
            {strength.tone === "positive" ? "↑" : "↓"}
          </Copy>
        )
      ) : (
        <Copy size={size} bold color={color}>
          {strength.label}
        </Copy>
      )}
    </View>
  );
}
