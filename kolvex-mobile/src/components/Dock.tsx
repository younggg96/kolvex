import { useState, type ComponentProps } from "react";
import { LayoutAnimation, Pressable, StyleSheet, View } from "react-native";
import { router, type Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { profile } from "../lib/contentApi";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { Copy, Glass } from "./UI";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type DockProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const TABS: { route: string; label: string; icon: SymbolName }[] = [
  {
    route: "index",
    label: "行情",
    icon: { ios: "globe", android: "public", web: "public" },
  },
  {
    route: "opinions",
    label: "观点",
    icon: { ios: "text.bubble", android: "chat", web: "chat" },
  },
  {
    route: "search",
    label: "搜索",
    icon: {
      ios: "magnifyingglass",
      android: "search",
      web: "search",
    },
  },
];
const MENU_ICON: SymbolName = {
  ios: "line.3.horizontal",
  android: "menu",
  web: "menu",
};
const MENU: {
  href: string;
  route?: string;
  label: string;
  icon: SymbolName;
}[] = [
  {
    href: "/watchlist",
    route: "watchlist",
    label: "自选",
    icon: { ios: "star", android: "star", web: "star" },
  },
  {
    href: "/briefs",
    label: "日报",
    icon: { ios: "newspaper", android: "newspaper", web: "newspaper" },
  },
  {
    href: "/news",
    label: "新闻",
    icon: {
      ios: "dot.radiowaves.left.and.right",
      android: "sensors",
      web: "sensors",
    },
  },
  {
    href: "/research",
    route: "research",
    label: "研究",
    icon: {
      ios: "binoculars",
      android: "travel_explore",
      web: "travel_explore",
    },
  },
  {
    href: "/settings",
    route: "settings",
    label: "设置",
    icon: { ios: "gearshape", android: "settings", web: "settings" },
  },
];
const ADMIN_ICON: SymbolName = {
  ios: "checkmark.shield",
  android: "verified_user",
  web: "verified_user",
};
const LOGOUT_ICON: SymbolName = {
  ios: "rectangle.portrait.and.arrow.right",
  android: "logout",
  web: "logout",
};

/** Floating glass dock matching the Web phone navigation in components/layout/MobileTabBar.tsx. */
export function Dock({ state }: DockProps) {
  const t = useTheme();
  const text = useText();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const user = auth.session?.user.id;
  const [open, setOpen] = useState(false);
  const account = useResource(`dock-profile:${user}`, (signal) =>
    user ? profile(user, signal) : Promise.resolve(null),
  );
  const current = state.routes[state.index]?.name;

  function toggle(next: boolean) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(next);
  }
  function openTab(route: string) {
    toggle(false);
    router.navigate((route === "index" ? "/" : `/${route}`) as never);
  }
  function openLink(item: { href: string; route?: string }) {
    if (item.route) openTab(item.route);
    else {
      toggle(false);
      router.push(item.href as never);
    }
  }

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { justifyContent: "flex-end" }]}
    >
      {open && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text("关闭导航菜单")}
          onPress={() => toggle(false)}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View
        pointerEvents="box-none"
        style={{
          paddingHorizontal: 20,
          paddingBottom: Math.max(16, insets.bottom),
          alignItems: "center",
        }}
      >
        <Glass
          material
          style={{
            width: "100%",
            maxWidth: 448,
            borderRadius: 28,
            padding: 4,
          }}
        >
          {open && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                padding: 4,
                paddingBottom: 8,
              }}
            >
              {MENU.map((item) => (
                <MenuItem
                  key={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={item.route === current}
                  onPress={() => openLink(item)}
                />
              ))}
              {account.data?.is_admin && (
                <MenuItem
                  label="管理"
                  icon={ADMIN_ICON}
                  onPress={() => openLink({ href: "/admin" })}
                />
              )}
              <MenuItem
                label="退出登录"
                icon={LOGOUT_ICON}
                color={t.negative}
                onPress={() => {
                  toggle(false);
                  void auth.signOut();
                }}
              />
            </View>
          )}
          <View style={{ flexDirection: "row", height: 46 }}>
            {TABS.map((tab) => (
              <DockButton
                key={tab.route}
                label={tab.label}
                icon={tab.icon}
                selected={tab.route === current}
                highlighted={tab.route === current && !open}
                onPress={() => openTab(tab.route)}
              />
            ))}
            <DockButton
              label="打开导航菜单"
              icon={MENU_ICON}
              expanded={open}
              highlighted={open}
              onPress={() => toggle(!open)}
            />
          </View>
        </Glass>
      </View>
    </View>
  );
}

function DockButton({
  label,
  icon,
  selected,
  expanded,
  highlighted,
  onPress,
}: {
  label: string;
  icon: SymbolName;
  selected?: boolean;
  expanded?: boolean;
  highlighted: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const text = useText();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text(label)}
      accessibilityState={{ selected, expanded }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 23,
        backgroundColor: highlighted || pressed ? t.tint : "transparent",
      })}
    >
      <SymbolView
        name={icon}
        size={21}
        weight={highlighted ? "semibold" : "regular"}
        tintColor={highlighted ? t.text : t.secondary}
      />
    </Pressable>
  );
}

function MenuItem({
  label,
  icon,
  active = false,
  color,
  onPress,
}: {
  label: string;
  icon: SymbolName;
  active?: boolean;
  color?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const foreground = color ?? (active ? t.text : t.secondary);
  return (
    <View style={{ width: "33.33%", padding: 2 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 60,
          gap: 4,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 20,
          backgroundColor: active || pressed ? t.tint : "transparent",
        })}
      >
        <SymbolView name={icon} size={20} tintColor={foreground} />
        <Copy size={12} color={foreground} lines={1}>
          {label}
        </Copy>
      </Pressable>
    </View>
  );
}
