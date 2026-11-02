import { useText } from "../../lib/i18n";
import { Tabs } from "expo-router";
import { useTheme } from "../../lib/theme";
export default function WebTabs() {
  const t = useTheme();
  const text = useText();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.secondary,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
        tabBarLabelStyle: { fontSize: 14 },
        tabBarIconStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: text("行情") }} />
      <Tabs.Screen name="opinions" options={{ title: text("观点") }} />
      <Tabs.Screen name="research" options={{ title: text("研究") }} />
      <Tabs.Screen name="watchlist" options={{ title: text("自选") }} />
      <Tabs.Screen name="settings" options={{ title: text("更多") }} />
    </Tabs>
  );
}
