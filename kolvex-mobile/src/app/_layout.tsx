import { useText } from "../lib/i18n";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PreferencesProvider } from "../state/Preferences";
import { AuthProvider, useAuth } from "../state/Auth";
import { WatchlistProvider } from "../state/Watchlist";
import { useTheme } from "../lib/theme";
export const unstable_settings = { anchor: "(tabs)" };

function AppContent() {
  const { session } = useAuth();
  const t = useTheme();
  const text = useText();
  return (
    <WatchlistProvider key={session?.user.id ?? "guest"}>
      <StatusBar style={t.dark ? "light" : "dark"} />
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
            headerTintColor: t.text,
            headerStyle: { backgroundColor: t.background },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: t.background },
          }}
        >
          <Stack.Screen
            name="technical/[symbol]"
            // iOS 26 pops on a horizontal swipe anywhere, which would take over chart panning.
            options={{ title: text("技术图表"), gestureEnabled: false }}
          />
          <Stack.Screen name="markets" options={{ title: text("市场全景") }} />
          <Stack.Screen name="admin" options={{ title: text("管理中心") }} />
          <Stack.Screen name="calendar" options={{ title: text("市场日历") }} />
          <Stack.Screen
            name="preferences"
            options={{ title: text("显示与模型设置") }}
          />
          <Stack.Screen
            name="research-tasks"
            options={{ title: text("我的研究任务") }}
          />
          <Stack.Screen
            name="research-task/[id]"
            options={{ title: text("研究任务") }}
          />
          <Stack.Screen
            name="creators"
            options={{ title: text("创作者与视频") }}
          />
          <Stack.Screen
            name="creator/[platform]/[id]"
            options={{ title: text("创作者资料") }}
          />
          <Stack.Screen name="updates" options={{ title: text("观点动态") }} />
          <Stack.Screen name="macro" options={{ title: text("宏观指标") }} />
          <Stack.Screen
            name="auth/callback"
            options={{ title: text("账户验证") }}
          />
          <Stack.Screen
            name="auth/recovery"
            options={{ title: text("账户恢复") }}
          />
          <Stack.Screen name="account" options={{ title: text("账户") }} />
          <Stack.Screen name="briefs" options={{ title: text("日报") }} />
          <Stack.Screen
            name="brief/[id]"
            options={{ title: text("日报详情") }}
          />
          <Stack.Screen
            name="report/[id]"
            options={{ title: text("研究报告") }}
          />
          <Stack.Screen name="news" options={{ title: text("新闻终端") }} />
          <Stack.Screen
            name="portfolio"
            options={{ title: text("投资组合") }}
          />
          <Stack.Screen
            name="chat/index"
            options={{ title: text("AI 对话") }}
          />
          <Stack.Screen name="chat/[id]" options={{ title: "Ask Kolvex" }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="stock/[symbol]"
            options={{ title: text("股票详情") }}
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
        <PreferenceScope />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function PreferenceScope() {
  const { session } = useAuth();
  return (
    <PreferencesProvider
      key={session?.user.id || "guest"}
      user={session?.user.id}
    >
      <AppContent />
    </PreferencesProvider>
  );
}
