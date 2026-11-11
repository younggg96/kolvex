// The Web's segmented tab bar drawn in SwiftUI: a Liquid Glass track, and a glass pill
// on the selected tab that morphs to the next tab with a native spring when it changes.
import { useId } from "react";
import { useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import {
  GlassEffectContainer,
  Group,
  HStack,
  Host,
  Image,
  Namespace,
  ScrollView,
  Text,
} from "@expo/ui/swift-ui";
import {
  Animation,
  accessibilityAddTraits,
  accessibilityLabel,
  animation,
  clipShape,
  contentShape,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  glassEffectId,
  onTapGesture,
  opacity,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { useText } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import { phone } from "../UI";
import type { GlassTabsProps } from "./GlassTabs";

export type { GlassTabsProps } from "./GlassTabs";
export const glassTabsAvailable = true;

export default function GlassTabs({
  values,
  value,
  onChange,
  size = "md",
  stretch = false,
  disabled = false,
  maxWidth,
  icons,
}: GlassTabsProps) {
  const t = useTheme();
  const screen = useWindowDimensions();
  // The page has 16pt gutters on each side.
  const limit = maxWidth ?? screen.width - 32;
  const text = useText();
  const namespace = useId();
  const selected = Math.max(
    0,
    values.findIndex(([key]) => key === value),
  );
  const height = phone(size === "sm" ? 32 : 40);
  const items = values.map(([key, label], index) => {
    const active = index === selected;
    const icon = icons?.[key];
    const modifiers = [
      font({ size: size === "sm" ? 13 : 14, weight: "semibold" }),
      foregroundStyle(active ? "#111111" : t.text),
      // Icon tabs are round; text tabs take their label's width.
      ...(icon
        ? []
        : [padding({ horizontal: phone(size === "sm" ? 12 : 16) })]),
      icon
        ? frame({ width: height, height })
        : frame(
            stretch
              ? { minHeight: height, maxWidth: 10_000 }
              : { minHeight: height },
          ),
      // The selected pill is one glass shape that moves between tabs.
      ...(active
        ? [
            glassEffect({
              glass: {
                variant: "regular",
                interactive: true,
                tint: "#FFFFFFF2",
              },
              shape: "capsule",
            }),
            glassEffectId("selected-tab", namespace),
          ]
        : []),
      contentShape(shapes.capsule()),
      accessibilityLabel(text(label)),
      accessibilityAddTraits(
        active ? ["isButton", "isSelected"] : ["isButton"],
      ),
      onTapGesture(() => {
        if (disabled || active) return;
        void Haptics.selectionAsync().catch(() => {});
        onChange(key);
      }),
    ];
    return icon ? (
      <Image
        key={key}
        systemName={icon as never}
        size={size === "sm" ? 13 : 15}
        modifiers={modifiers}
      />
    ) : (
      <Text key={key} modifiers={modifiers}>
        {text(label)}
      </Text>
    );
  });
  const trackGlass = glassEffect({
    glass: { variant: "regular" },
    shape: "capsule",
  });
  const row = (
    <GlassEffectContainer
      spacing={4}
      modifiers={[
        padding({ all: 3 }),
        animation(Animation.snappy({ duration: 0.32 }), selected),
      ]}
    >
      <HStack spacing={2}>{items}</HStack>
    </GlassEffectContainer>
  );
  // The track's height is known up front (tab + 3pt padding on each side). Giving the
  // host that height, rather than measuring it, keeps the rows below from laying out
  // against a zero-height host and drawing under the tabs on first mount.
  const trackHeight = height + 6;
  return (
    <Host
      // Yoga places this host; SwiftUI must not push its content away from the
      // status bar or keyboard when the host scrolls under them.
      ignoreSafeArea="all"
      // A full-width bar fills its row; otherwise the track takes its own width,
      // capped by the row, and scrolls when the tabs are wider.
      matchContents={stretch ? false : { horizontal: true }}
      colorScheme={t.dark ? "dark" : "light"}
      style={
        stretch
          ? { alignSelf: "stretch", height: trackHeight }
          : {
              alignSelf: "flex-start",
              maxWidth: "100%",
              flexShrink: 1,
              height: trackHeight,
            }
      }
    >
      <Namespace id={namespace}>
        {stretch ? (
          <Group modifiers={[trackGlass, opacity(disabled ? 0.45 : 1)]}>
            {row}
          </Group>
        ) : (
          // The glass capsule wraps the scroller, so its ends stay round while tabs scroll.
          <ScrollView
            axes="horizontal"
            showsIndicators={false}
            modifiers={[
              frame({ maxWidth: limit }),
              clipShape("capsule"),
              trackGlass,
              opacity(disabled ? 0.45 : 1),
            ]}
          >
            {row}
          </ScrollView>
        )}
      </Namespace>
    </Host>
  );
}
