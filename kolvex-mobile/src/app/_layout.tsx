import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../state/Auth";
import { WatchlistProvider } from "../state/Watchlist";
import { useTheme } from "../lib/theme";
export const unstable_settings = { anchor: "(tabs)" };

function AppContent() {
  const { session } = useAuth();
  const t = useTheme();
  return (
    <WatchlistProvider key={session?.user.id ?? "guest"}>
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
          <Stack.Screen
            name="account"
            options={{ title: "账户", headerBackTitle: "返回" }}
          />
          <Stack.Screen
            name="briefs"
            options={{ title: "日报", headerBackTitle: "返回" }}
          />
          <Stack.Screen
            name="brief/[id]"
            options={{ title: "日报详情", headerBackTitle: "返回" }}
          />
          <Stack.Screen
            name="report/[id]"
            options={{ title: "研究报告", headerBackTitle: "返回" }}
          />
          <Stack.Screen
            name="news"
            options={{ title: "新闻终端", headerBackTitle: "返回" }}
          />
          <Stack.Screen
            name="portfolio"
            options={{ title: "投资组合", headerBackTitle: "返回" }}
          />
          <Stack.Screen
            name="chat/index"
            options={{ title: "AI 对话", headerBackTitle: "返回" }}
          />
          <Stack.Screen
            name="chat/[id]"
            options={{ title: "Ask Kolvex", headerBackTitle: "返回" }}
          />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="stock/[symbol]"
            options={{ title: "股票详情", headerBackTitle: "返回" }}
          />
        </Stack>
      </View>
    </WatchlistProvider>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
