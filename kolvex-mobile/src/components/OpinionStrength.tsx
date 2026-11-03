import { View } from "react-native";
import { describeStrength } from "../lib/opinionStrength";
import { useTheme } from "../lib/theme";
import { Copy } from "./UI";
/** Direction and magnitude as words; numeric scores stay hidden. */
export function OpinionStrength({
  value,
  change = false,
}: {
  value?: number | null;
  change?: boolean;
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
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
      <Copy size={14} bold color={color}>
        {strength.label}
      </Copy>
    </View>
  );
}
