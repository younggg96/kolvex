import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useText } from "../../lib/i18n";
import { NativeTabs } from "expo-router/native-tabs";
import { useTheme } from "../../lib/theme";
export default function Tabs() {
  const t = useTheme();
  const text = useText();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <NativeTabs tintColor={t.accent}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="chart.xyaxis.line" md="show_chart" />
          <NativeTabs.Trigger.Label>{text("行情")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="opinions">
          <NativeTabs.Trigger.Icon
            sf="bubble.left.and.bubble.right"
            md="forum"
          />
          <NativeTabs.Trigger.Label>{text("观点")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="research">
          <NativeTabs.Trigger.Icon
            sf="doc.text.magnifyingglass"
            md="description"
          />
          <NativeTabs.Trigger.Label>{text("研究")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="watchlist">
          <NativeTabs.Trigger.Icon sf="star" md="star_outline" />
          <NativeTabs.Trigger.Label>{text("自选")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="slider.horizontal.3" md="tune" />
          <NativeTabs.Trigger.Label>{text("更多")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      {/* Tab screens have no navigation bar, so content would scroll under the status bar. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: t.background,
        }}
      />
    </View>
  );
}
