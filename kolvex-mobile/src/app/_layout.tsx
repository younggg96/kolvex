import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WatchlistProvider } from "../state/Watchlist";
import { useTheme } from "../lib/theme";
export default function Layout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <WatchlistProvider>
        <StatusBar style="auto" />
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: Platform.OS === "web" ? 480 : undefined,
            alignSelf: "center",
          }}
        >
          <Stack
            screenOptions={{
              headerTintColor: t.accent,
              headerStyle: { backgroundColor: t.background },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: t.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="stock/[symbol]"
              options={{ title: "股票详情", headerBackTitle: "返回" }}
            />
          </Stack>
        </View>
      </WatchlistProvider>
    </SafeAreaProvider>
  );
}
