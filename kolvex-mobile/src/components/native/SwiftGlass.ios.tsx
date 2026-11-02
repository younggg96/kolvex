import { Host, Group, RNHostView } from "@expo/ui/swift-ui";
import { glassEffect } from "@expo/ui/swift-ui/modifiers";
import { View, StyleSheet, type ViewProps, type ViewStyle } from "react-native";
import { useTheme } from "../../lib/theme";
// Yoga owns placement and width; SwiftUI owns material. RNHostView measures the
// native content's height so long text and forms retain their natural layout.
const placement =
  /^(width|height|minWidth|maxWidth|minHeight|maxHeight|flex|flexGrow|flexShrink|flexBasis|alignSelf|margin.*|position|top|right|bottom|left|display)$/;
export default function SwiftGlass({ children, style, ...props }: ViewProps) {
  const t = useTheme();
  const flat = StyleSheet.flatten(style) || {};
  const layout = Object.fromEntries(
    Object.entries(flat).filter(([key]) => placement.test(key)),
  ) as ViewStyle;
  const content = Object.fromEntries(
    Object.entries(flat).filter(([key]) => !placement.test(key)),
  ) as ViewStyle;
  return (
    <Host
      matchContents={{ vertical: true }}
      style={[{ alignSelf: "stretch" }, layout]}
      colorScheme={t.dark ? "dark" : "light"}
    >
      <Group
        modifiers={[
          glassEffect({
            glass: { variant: "clear" },
            shape: "roundedRectangle",
            cornerRadius:
              typeof flat.borderRadius === "number" ? flat.borderRadius : 24,
          }),
        ]}
      >
        <RNHostView matchContents={{ vertical: true }}>
          <View
            {...props}
            style={[content, { backgroundColor: "transparent" }]}
          >
            {children}
          </View>
        </RNHostView>
      </Group>
    </Host>
  );
}
