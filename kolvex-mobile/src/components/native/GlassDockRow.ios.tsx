// The Web's dock buttons drawn in SwiftUI: the highlighted tab sits on a Liquid Glass
// pill that morphs to the next tab with a native spring when the selection changes.
import { useId } from "react";
import * as Haptics from "expo-haptics";
import {
  GlassEffectContainer,
  HStack,
  Host,
  Image,
  Namespace,
} from "@expo/ui/swift-ui";
import {
  Animation,
  accessibilityAddTraits,
  accessibilityLabel,
  animation,
  contentShape,
  frame,
  glassEffect,
  glassEffectId,
  onTapGesture,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { useText } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import type { GlassDockRowProps } from "./GlassDockRow";

export type { GlassDockItem, GlassDockRowProps } from "./GlassDockRow";
export const glassDockAvailable = true;

export default function GlassDockRow({ items, onPress }: GlassDockRowProps) {
  const t = useTheme();
  const text = useText();
  const namespace = useId();
  const highlighted = items.findIndex((item) => item.highlighted);
  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme={t.dark ? "dark" : "light"}
      style={{ alignSelf: "stretch", height: 46 }}
    >
      <Namespace id={namespace}>
        <GlassEffectContainer
          spacing={8}
          modifiers={[
            animation(Animation.snappy({ duration: 0.34 }), highlighted),
          ]}
        >
          <HStack spacing={0}>
            {items.map((item) => (
              <Image
                key={item.key}
                systemName={item.symbol as never}
                size={21}
                color={item.highlighted ? t.text : t.secondary}
                modifiers={[
                  frame({
                    minWidth: 0,
                    maxWidth: 10_000,
                    minHeight: 46,
                    maxHeight: 46,
                  }),
                  ...(item.highlighted
                    ? [
                        glassEffect({
                          glass: { variant: "regular", interactive: true },
                          shape: "capsule",
                        }),
                        glassEffectId("dock-selection", namespace),
                      ]
                    : []),
                  contentShape(shapes.rectangle()),
                  accessibilityLabel(text(item.label)),
                  accessibilityAddTraits(
                    item.selected ? ["isButton", "isSelected"] : ["isButton"],
                  ),
                  onTapGesture(() => {
                    if (!item.selected)
                      void Haptics.selectionAsync().catch(() => {});
                    onPress(item.key);
                  }),
                ]}
              />
            ))}
          </HStack>
        </GlassEffectContainer>
      </Namespace>
    </Host>
  );
}
