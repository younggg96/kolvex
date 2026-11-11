import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentRef,
  type ReactNode,
} from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router, type Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { profile } from "../lib/contentApi";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import GlassDockRow, { glassDockAvailable } from "./native/GlassDockRow";
import { Copy, Glass, useLiquidGlass } from "./UI";

/** The iOS SF Symbol name of an icon. */
const symbolOf = (icon: SymbolName) =>
  typeof icon === "object" && icon && "ios" in icon
    ? String(icon.ios)
    : "circle";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type DockProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

// The Web's MobileTabBar: Chat, Markets and KOL opinions in the dock, then Search and Menu.
const TABS: { route: string; label: string; icon: SymbolName }[] = [
  {
    route: "chat",
    label: "对话",
    icon: {
      ios: "bubble.left.and.bubble.right",
      android: "forum",
      web: "forum",
    },
  },
  {
    route: "index",
    label: "行情",
    icon: { ios: "globe", android: "public", web: "public" },
  },
  {
    route: "opinions",
    label: "KOL 观点",
    icon: { ios: "text.bubble", android: "chat", web: "chat" },
  },
  {
    route: "search",
    label: "探索",
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
// Everything the Web's dock menu lists, in its order.
const MENU: {
  href: string;
  route?: string;
  label: string;
  icon: SymbolName;
}[] = [
  {
    href: "/watchlist",
    route: "watchlist",
    label: "自选股",
    icon: { ios: "star", android: "star", web: "star" },
  },
  {
    href: "/briefs",
    route: "briefs",
    label: "日报",
    icon: { ios: "newspaper", android: "newspaper", web: "newspaper" },
  },
  {
    href: "/news",
    route: "news",
    label: "新闻",
    icon: {
      ios: "dot.radiowaves.left.and.right",
      android: "sensors",
      web: "sensors",
    },
  },
  {
    href: "/workspaces",
    route: "workspaces",
    label: "工作区",
    icon: { ios: "folder", android: "folder", web: "folder" },
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
    href: "/superinvestors",
    label: "超级投资者",
    icon: {
      ios: "building.columns",
      android: "account_balance",
      web: "account_balance",
    },
  },
  {
    href: "/congress-trades",
    label: "国会议员交易",
    icon: { ios: "scroll", android: "receipt_long", web: "receipt_long" },
  },
  {
    href: "/options-activity",
    label: "期权异动",
    icon: {
      ios: "waveform.path.ecg",
      android: "monitor_heart",
      web: "monitor_heart",
    },
  },
  {
    href: "/paper-trading",
    label: "虚拟交易",
    icon: { ios: "book", android: "menu_book", web: "menu_book" },
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
const BACK_ICON: SymbolName = {
  ios: "chevron.backward",
  android: "arrow_back",
  web: "arrow_back",
};

/** What the focused search screen shows inside the dock's expanded surface. */
export type DockSearchSlot = {
  /** The search field, rendered directly above the keyboard. */
  field: ReactNode;
  /** Recent searches, shown above the field. */
  recent: ReactNode;
  /** Leaves the search screen and restores the tab dock. */
  onCancel: () => void;
  /** Back out of the screen; returns false to stay and only clear the query. */
  onBack: () => boolean;
};

/**
 * The search screen owns the query, but the dock renders the field above the
 * keyboard. Screens hold the slot while focused and release it on blur, so the
 * dock shows at most one search at a time.
 */
type Held = { id: string; content: DockSearchSlot };
const slot: { current: Held | null } = { current: null };
const listeners = new Set<() => void>();
function publish(next: Held | null) {
  slot.current = next;
  listeners.forEach((notify) => notify());
}

/**
 * Ties one screen to the dock's search surface. `id` identifies the screen, so a
 * screen that leaves only clears the slot when the dock still shows *its* copy.
 */
export function useDockSearch(id: string, content: DockSearchSlot) {
  const latest = useRef(content);
  useEffect(() => {
    latest.current = content;
  });
  /** Claims the dock's expanded surface; call when the screen gains focus. */
  const hold = useCallback(() => {
    publish({ id, content: latest.current });
  }, [id]);
  // Leaving (or losing focus) releases only this screen's own slot, so a newer
  // search that took the dock over keeps rendering.
  const release = useCallback(() => {
    if (slot.current?.id === id) publish(null);
  }, [id]);
  useEffect(() => release, [release]);
  return { hold, release };
}

/** The dock's view of the slot, re-rendering when a screen claims or releases it. */
function useDockSlot() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const notify = () => setTick((tick) => tick + 1);
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);
  return slot.current?.content;
}

/** Floating glass dock matching the Web phone navigation in components/layout/MobileTabBar.tsx. */
export function Dock({ state }: DockProps) {
  const t = useTheme();
  const liquidGlass = useLiquidGlass();
  const text = useText();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const user = auth.session?.user.id;
  const [open, setOpen] = useState(false);
  // The search screen expands the dock into its search bar, above the keyboard.
  const search = useDockSlot();
  // Browsers report no keyboard resize, so the focused field measures how far
  // down the visible viewport ends and lifts itself above that edge.
  const [webLift, setWebLift] = useState(0);
  const surface = useRef<ComponentRef<typeof View>>(null);
  const lift = () => {
    const viewport =
      typeof window === "undefined" ? undefined : window.visualViewport;
    if (!viewport) return;
    surface.current?.measureInWindow((_x, y, _width, height) => {
      setWebLift(
        Math.max(
          0,
          Math.round(y + height - (viewport.offsetTop + viewport.height)),
        ),
      );
    });
  };
  const account = useResource(`dock-profile:${user}`, (signal) =>
    user ? profile(user, signal) : Promise.resolve(null),
  );
  const current = state.routes[state.index]?.name;
  // iOS draws the buttons in SwiftUI so the selection morphs between tabs in Liquid Glass.
  const nativeRow = glassDockAvailable && liquidGlass;

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
          paddingHorizontal: 16,
          // Browsers report no keyboard resize, so the focused field lifts itself above it.
          paddingBottom: Math.max(16, insets.bottom) + webLift,
          alignItems: "center",
        }}
      >
        <View
          ref={surface}
          collapsable={false}
          pointerEvents="box-none"
          onFocus={() => Platform.OS === "web" && lift()}
          style={{ width: "100%", maxWidth: 448, alignItems: "center" }}
        >
          <Glass
            material
            style={{
              width: "100%",
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
                    label="管理员"
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
            {!!search && (
              <View pointerEvents="box-none" style={{ paddingBottom: 8 }}>
                {search.recent}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingTop: 4,
                  }}
                >
                  {search.field}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => search.onCancel()}
                    style={{
                      height: 46,
                      minWidth: 44,
                      paddingHorizontal: 8,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Copy>取消</Copy>
                  </Pressable>
                </View>
              </View>
            )}
            {nativeRow ? (
              <GlassDockRow
                items={
                  search
                    ? [
                        {
                          key: "back",
                          label: "返回",
                          symbol: symbolOf(BACK_ICON),
                          highlighted: false,
                        },
                        {
                          key: "menu",
                          label: "打开导航菜单",
                          symbol: symbolOf(MENU_ICON),
                          highlighted: open,
                          expanded: open,
                        },
                      ]
                    : [
                        ...TABS.map((tab) => ({
                          key: tab.route,
                          label: tab.label,
                          symbol: symbolOf(tab.icon),
                          selected: tab.route === current,
                          highlighted: tab.route === current && !open,
                        })),
                        {
                          key: "menu",
                          label: "打开导航菜单",
                          symbol: symbolOf(MENU_ICON),
                          highlighted: open,
                          expanded: open,
                        },
                      ]
                }
                onPress={(key) => {
                  if (key === "menu") toggle(!open);
                  else if (key === "back") {
                    if (search && !search.onBack()) search.onCancel();
                  } else openTab(key);
                }}
              />
            ) : search ? (
              <View style={{ flexDirection: "row", height: 46 }}>
                <DockButton
                  label="返回"
                  icon={BACK_ICON}
                  highlighted={false}
                  onPress={() => {
                    if (!search.onBack()) search.onCancel();
                  }}
                />
                <DockButton
                  label="打开导航菜单"
                  icon={MENU_ICON}
                  expanded={open}
                  highlighted={open}
                  onPress={() => toggle(!open)}
                />
              </View>
            ) : (
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
            )}
          </Glass>
        </View>
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
