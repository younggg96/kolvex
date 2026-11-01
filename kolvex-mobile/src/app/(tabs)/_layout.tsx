import { NativeTabs } from "expo-router/native-tabs";
import { useTheme } from "../../lib/theme";
export default function Tabs() {
  const t = useTheme();
  return (
    <NativeTabs tintColor={t.accent}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="chart.xyaxis.line" md="show_chart" />
        <NativeTabs.Trigger.Label>行情</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="opinions">
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right" md="forum" />
        <NativeTabs.Trigger.Label>观点</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="research">
        <NativeTabs.Trigger.Icon
          sf="doc.text.magnifyingglass"
          md="description"
        />
        <NativeTabs.Trigger.Label>研究</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="watchlist">
        <NativeTabs.Trigger.Icon sf="star" md="star_outline" />
        <NativeTabs.Trigger.Label>自选</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="slider.horizontal.3" md="tune" />
        <NativeTabs.Trigger.Label>更多</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
