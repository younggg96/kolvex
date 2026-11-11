import { Tabs } from "expo-router";
import { View } from "react-native";
import { Dock } from "../../components/Dock";
import { StatusScrim } from "../../components/UI";
import { useTheme } from "../../lib/theme";

// The dock owns navigation, so routes without a dock button stay reachable from its menu.
export default function TabsLayout() {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <Dock {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: t.background },
        }}
      >
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="index" />
        <Tabs.Screen name="opinions" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="watchlist" />
        <Tabs.Screen name="research" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <StatusScrim />
    </View>
  );
}
