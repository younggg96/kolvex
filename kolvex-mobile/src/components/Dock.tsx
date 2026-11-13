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
import { router, usePathname, type Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { profile } from "../lib/contentApi";
import { portfolioEnabled } from "../lib/productFeatures";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { Copy, Glass } from "./UI";

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
  ...(portfolioEnabled
    ? [
        {
          href: "/portfolio",
          label: "投资组合",
          icon: { ios: "briefcase", android: "work", web: "work" } as SymbolName,
        },
      ]
    : []),
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

/** What the focused search screen shows inside the dock's expanded surface. */
export type DockSearchSlot = {
  /** The search field, rendered directly above the keyboard. */
  field: ReactNode;
  /** Recent searches, shown above the field. */
  recent: ReactNode;
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

/** Floating navigation for Android and web. */
export function Dock({ state }: DockProps) {
  const text = useText();
  const insets = useSafeAreaInsets();
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
  const current = state.routes[state.index]?.name;

  function toggle(next: boolean) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(next);
  }
  function openTab(route: string) {
    toggle(false);
    router.navigate((route === "index" ? "/" : `/${route}`) as never);
  }
  // The search screen's field sits above this row, so the dock never trades its
  // navigation buttons for a search-only control: the field clears its own query
  // and the row's tabs leave the search.
  const navItems: {
    key: string;
    label: string;
    icon: SymbolName;
    selected?: boolean;
    highlighted: boolean;
    expanded?: boolean;
  }[] = [
    ...TABS.map((tab) => ({
      key: tab.route,
      label: tab.label,
      icon: tab.icon,
      selected: tab.route === current,
      highlighted: tab.route === current && !open,
    })),
    {
      key: "menu",
      label: "打开导航菜单",
      icon: MENU_ICON,
      highlighted: open,
      expanded: open,
    },
  ];
  function pressDock(key: string) {
    if (key === "menu") toggle(!open);
    else openTab(key);
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
            glassVariant="regular"
            style={{
              width: "100%",
              borderRadius: 28,
              padding: 4,
            }}
          >
            {open && <DockMenu onNavigate={() => toggle(false)} />}
            {!!search && (
              <View
                pointerEvents="box-none"
                style={{ paddingTop: 4, paddingBottom: 8 }}
              >
                {search.recent}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {search.field}
                </View>
              </View>
            )}
            <View style={{ flexDirection: "row", height: 46 }}>
              {navItems.map((item) => (
                <DockButton
                  key={item.key}
                  label={item.label}
                  icon={item.icon}
                  selected={item.selected}
                  expanded={item.expanded}
                  highlighted={item.highlighted}
                  onPress={() => pressDock(item.key)}
                />
              ))}
            </View>
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
        size={18}
        weight={highlighted ? "semibold" : "regular"}
        tintColor={highlighted ? t.text : t.secondary}
      />
    </Pressable>
  );
}

export function DockMenu({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const auth = useAuth();
  const user = auth.session?.user.id;
  const account = useResource(`dock-profile:${user}`, (signal) =>
    user ? profile(user, signal) : Promise.resolve(null),
  );

  function openLink(item: { href: string; route?: string }) {
    onNavigate?.();
    if (item.route) router.navigate(item.href as never);
    else router.push(item.href as never);
  }

  return (
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
          active={item.href === pathname}
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
    </View>
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
