import { useState } from "react";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform, View } from "react-native";
import { BottomSheet, RNHostView } from "@expo/ui";
import { presentationBackgroundInteraction } from "@expo/ui/swift-ui/modifiers";
import { Dock } from "../../components/Dock";
import { MoreMenu } from "../../components/MoreMenu";
import { useLiquidGlass } from "../../components/UI";
import { profile } from "../../lib/contentApi";
import { useText } from "../../lib/i18n";
import { useResource } from "../../lib/useResource";
import { useAuth } from "../../state/Auth";
import { useTheme } from "../../lib/theme";
import { TabBarVisibility } from "../../state/TabBarVisibility";
import { usePreferences } from "../../state/Preferences";

export const unstable_settings = { anchor: "index" };
export default function TabsLayout() {
  const [hidden, setHidden] = useState(false);
  return (
    <TabBarVisibility.Provider value={setHidden}>
      <TabNavigator hidden={hidden} />
    </TabBarVisibility.Provider>
  );
}

function TabNavigator({ hidden }: { hidden: boolean }) {
  const t = useTheme();
  const text = useText();
  const { theme } = usePreferences();
  const glass = useLiquidGlass();
  const user = useAuth().session?.user.id;
  const account = useResource(`dock-profile:${user}`, (signal) =>
    user ? profile(user, signal) : Promise.resolve(null),
  );
  // The ··· tab opens the menu as a sheet over the current tab instead of switching to it.
  const [menuOpen, setMenuOpen] = useState(false);

  if (Platform.OS === "ios") {
    const colorScheme = t.dark ? "dark" : "light";
    return (
      <>
        <NativeTabs
          hidden={hidden}
          tintColor={t.text}
          unstable_nativeProps={{
            colorScheme: theme === "SYSTEM" ? "inherit" : colorScheme,
          }}
        >
          <NativeTabs.Trigger name="chat" accessibilityLabel={text("对话")}>
            <NativeTabs.Trigger.Icon
              renderingMode="template"
              src={{
                default: require("../../../assets/tab-icons/chat.png"),
                selected: require("../../../assets/tab-icons/chat-selected.png"),
              }}
            />
            <NativeTabs.Trigger.Label hidden />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="index" accessibilityLabel={text("行情")}>
            <NativeTabs.Trigger.Icon
              renderingMode="template"
              src={require("../../../assets/tab-icons/markets.png")}
            />
            <NativeTabs.Trigger.Label hidden />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="opinions" accessibilityLabel={text("观点")}>
            <NativeTabs.Trigger.Icon
              renderingMode="template"
              src={{
                default: require("../../../assets/tab-icons/opinions.png"),
                selected: require("../../../assets/tab-icons/opinions-selected.png"),
              }}
            />
            <NativeTabs.Trigger.Label hidden />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger
            name="(more)"
            accessibilityLabel={text("更多")}
            disabled
            disablePopToTop
            listeners={{ tabPress: () => setMenuOpen(true) }}
          >
            <NativeTabs.Trigger.Icon
              renderingMode="template"
              src={require("../../../assets/tab-icons/more.png")}
            />
            <NativeTabs.Trigger.Label hidden />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger
            name="search"
            role="search"
            accessibilityLabel={text("探索")}
          >
            <NativeTabs.Trigger.Icon
              renderingMode="template"
              src={require("../../../assets/tab-icons/search.png")}
            />
            <NativeTabs.Trigger.Label hidden />
          </NativeTabs.Trigger>
        </NativeTabs>
        <BottomSheet
          isPresented={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          containerColor={glass ? undefined : t.surface}
          contentPadding={{ top: 28, bottom: 12, left: 16, right: 16 }}
          // No dimmed backdrop: the page behind stays as it is.
          modifiers={[presentationBackgroundInteraction("enabled")]}
        >
          <RNHostView matchContents={{ vertical: true }}>
            <View>
              <MoreMenu
                onNavigate={() => setMenuOpen(false)}
                isAdmin={!!account.data?.is_admin}
              />
            </View>
          </RNHostView>
        </BottomSheet>
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => (hidden ? null : <Dock {...props} />)}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: t.background },
        }}
      >
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="index" />
        <Tabs.Screen name="opinions" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="(more)" />
      </Tabs>
    </View>
  );
}
