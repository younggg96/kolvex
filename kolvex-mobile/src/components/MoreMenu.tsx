// The ··· tab's sheet on iOS: the dock menu as a three-column grid of round icon
// wells with a label underneath, like the share sheet and Control Center.
import { Pressable, View } from "react-native";
import { router, usePathname } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { portfolioEnabled } from "../lib/productFeatures";
import { useTheme } from "../lib/theme";
import { Copy } from "./UI";

type Item = {
  href: string;
  /** Tab-root routes are navigated to; the rest are pushed. */
  route?: boolean;
  label: string;
  icon: SymbolViewProps["name"];
};

// The Web's dock menu order; Log out now lives in Settings.
const ITEMS: Item[] = [
  { href: "/watchlist", route: true, label: "自选股", icon: "star" },
  { href: "/briefs", route: true, label: "日报", icon: "newspaper" },
  {
    href: "/news",
    route: true,
    label: "新闻",
    icon: "dot.radiowaves.left.and.right",
  },
  { href: "/workspaces", route: true, label: "工作区", icon: "folder" },
  { href: "/research", route: true, label: "研究", icon: "binoculars" },
  { href: "/superinvestors", label: "超级投资者", icon: "building.columns" },
  { href: "/congress-trades", label: "国会议员交易", icon: "scroll" },
  { href: "/options-activity", label: "期权异动", icon: "waveform.path.ecg" },
  { href: "/paper-trading", label: "虚拟交易", icon: "book" },
  ...(portfolioEnabled
    ? [{ href: "/portfolio", label: "投资组合", icon: "briefcase" } as Item]
    : []),
  { href: "/settings", route: true, label: "设置", icon: "gearshape" },
];
const ADMIN: Item = {
  href: "/admin",
  label: "管理员",
  icon: "checkmark.shield",
};

export function MoreMenu({
  onNavigate,
  isAdmin,
}: {
  onNavigate: () => void;
  /** Read by the always-mounted tab layout, so the tile doesn't pop in each time the sheet opens. */
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const items = isAdmin ? [...ITEMS, ADMIN] : ITEMS;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 18 }}>
      {items.map((item) => (
        <Tile
          key={item.href}
          item={item}
          active={
            pathname === item.href ||
            pathname.startsWith(`${item.href.replace(/s$/, "")}/`)
          }
          onPress={() => {
            onNavigate();
            if (item.route) router.navigate(item.href as never);
            else router.push(item.href as never);
          }}
        />
      ))}
    </View>
  );
}

function Tile({
  item,
  active,
  onPress,
}: {
  item: Item;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ width: "33.33%", alignItems: "center" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={({ pressed }) => ({
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 4,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? "rgba(255,255,255,0.97)" : t.wash,
            borderWidth: active ? 0 : 1,
            borderColor: t.rim,
          }}
        >
          <SymbolView
            name={item.icon}
            size={22}
            tintColor={active ? "#111111" : t.text}
          />
        </View>
        <Copy size={13} lines={1}>
          {item.label}
        </Copy>
      </Pressable>
    </View>
  );
}
