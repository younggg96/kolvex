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
  const { session, ready } = useAuth();
  const t = useTheme();
  const text = useText();
  // Hold the navigator until the stored session is read, so a signed-in launch
  // never flashes sign-in or loses the route a deep link asked for.
  if (!ready)
    return <View style={{ flex: 1, backgroundColor: t.background }} />;
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
            headerUserInterfaceStyle: t.dark ? "dark" : "light",
            // iOS 26 draws this bar as Liquid Glass; pages keep drawing their own large
            // titles, so the bar shows only the native Back control.
            headerTransparent: false,
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            // Each page draws its own large title; the bar keeps only Back.
            // `title` stays set per screen for VoiceOver and the app switcher.
            headerTitle: "",
            contentStyle: { backgroundColor: t.background },
          }}
        >
          <Stack.Protected guard={!session}>
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!!session}>
            <Stack.Screen
              name="technical/[symbol]"
              // iOS 26 pops on a horizontal swipe anywhere, which would take over chart panning.
              options={{ title: text("技术图表"), gestureEnabled: false }}
            />
            <Stack.Screen
              name="markets"
              options={{ title: text("市场全景") }}
            />
            <Stack.Screen
              name="calendar"
              options={{ title: text("市场日历") }}
            />
            <Stack.Screen
              name="preferences"
              options={{ title: text("显示与模型设置") }}
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
            <Stack.Screen
              name="updates"
              options={{ title: text("观点动态") }}
            />
            <Stack.Screen name="macro" options={{ title: text("宏观指标") }} />
            <Stack.Screen
              name="+not-found"
              options={{ title: text("页面未找到") }}
            />
            <Stack.Screen
              name="superinvestor/[manager]"
              options={{ title: text("13F 持仓") }}
            />
            <Stack.Screen name="account" options={{ title: text("账户") }} />
            <Stack.Screen
              name="report/[id]"
              options={{ title: text("研究报告") }}
            />
            <Stack.Screen
              name="portfolio"
              options={{ title: text("投资组合") }}
            />

            <Stack.Screen
              name="chat/[id]"
              options={{
                title: "Ask Kolvex",
                ...(Platform.OS === "ios" && {
                  headerTransparent: true,
                  headerStyle: { backgroundColor: "transparent" },
                }),
              }}
            />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="stock/[symbol]"
              options={{ title: text("股票详情") }}
            />
          </Stack.Protected>
          <Stack.Screen
            name="auth/callback"
            options={{ title: text("账户验证") }}
          />
          <Stack.Screen
            name="auth/recovery"
            options={{ title: text("账户恢复") }}
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
