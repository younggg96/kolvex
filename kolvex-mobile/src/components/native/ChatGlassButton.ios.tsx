import { Button, Host, HStack, Image, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "../../lib/theme";
import type { ChatGlassButtonProps } from "./ChatGlassButton";

export default function ChatGlassButton({
  icon,
  label,
  showLabel,
  onPress,
}: ChatGlassButtonProps) {
  const t = useTheme();
  const color = showLabel ? t.onBrand : t.text;
  return (
    <Host
      // Yoga places this host; SwiftUI must not push its content away from the
      // status bar or keyboard when the host scrolls under them.
      ignoreSafeArea="all"
      matchContents
      colorScheme={t.dark ? "dark" : "light"}
    >
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle(showLabel ? "glassProminent" : "glass"),
          controlSize("large"),
          // Icon-only buttons are round, like ChatGPT's; labelled ones stay capsules.
          buttonBorderShape(showLabel ? "capsule" : "circle"),
          ...(showLabel ? [tint(t.brand)] : []),
          accessibilityLabel(label),
        ]}
      >
        <HStack
          spacing={7}
          modifiers={[
            showLabel
              ? frame({ minWidth: 22 })
              : frame({ width: 24, height: 24 }),
          ]}
        >
          <Image
            systemName={
              icon === "history"
                ? "line.3.horizontal.decrease"
                : icon === "new"
                  ? "square.and.pencil"
                  : icon === "workspace"
                    ? "folder"
                    : "folder.fill"
            }
            size={18}
            color={color}
          />
          {showLabel && (
            <Text
              modifiers={[
                font({ textStyle: "subheadline", weight: "semibold" }),
                foregroundStyle(color),
              ]}
            >
              {label}
            </Text>
          )}
        </HStack>
      </Button>
    </Host>
  );
}
