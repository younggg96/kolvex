import { Button, Host, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  accessibilityAddTraits,
  buttonStyle,
  controlSize,
  disabled as disable,
  frame,
  tint,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "../../lib/theme";
import type { SwiftButtonProps } from "./SwiftButton";
export const swiftButtonsAvailable = true;
export default function SwiftButton({
  children,
  onPress,
  selected,
  disabled,
  label,
}: SwiftButtonProps) {
  const t = useTheme();
  return (
    <Host matchContents colorScheme={t.dark ? "dark" : "light"}>
      <Button
        onPress={disabled ? undefined : onPress}
        modifiers={[
          buttonStyle(selected ? "glassProminent" : "glass"),
          controlSize("large"),
          tint(selected ? t.tint : t.surface),
          disable(disabled),
          ...(label ? [accessibilityLabel(label)] : []),
          ...(selected ? [accessibilityAddTraits(["isSelected"])] : []),
        ]}
      >
        <Text
          modifiers={[
            frame({ minWidth: 44, minHeight: 44 }),
            foregroundStyle(t.text),
          ]}
        >
          {children}
        </Text>
      </Button>
    </Host>
  );
}
