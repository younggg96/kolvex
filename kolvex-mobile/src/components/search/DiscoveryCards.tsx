// The Web's search discovery (components/decision/SearchDiscovery.tsx) at phone size:
// list cards with a source switch, ranked stock rows with logos in two columns, creator
// rows with avatars, then the latest research, news and briefs as compact rows.
import { useState, type ReactNode } from "react";
import { Image, Pressable, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useTheme } from "../../lib/theme";
import { CompanyLogo } from "../CompanyLogo";
import { Filters } from "../Content";
import { Copy, Glass, Skeleton, phone } from "../UI";

export type Pick = {
  key: string;
  title: string;
  detail: string;
  onPress: () => void;
};

function Arrow({ size = 12 }: { size?: number }) {
  const t = useTheme();
  return (
    <SymbolView
      name={{ ios: "arrow.up.right", android: "north_east", web: "north_east" }}
      size={size}
      tintColor={t.secondary}
    />
  );
}

/** The Web's DiscoverySection header: an h2 and a "View all" link with an arrow. */
export function DiscoverySection({
  title,
  onViewAll,
  children,
}: {
  title: string;
  onViewAll?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          minHeight: 38,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Copy size={16} bold>
          {title}
        </Copy>
        {!!onViewAll && (
          <Pressable
            accessibilityRole="link"
            onPress={onViewAll}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Copy size={12} muted>
              查看全部
            </Copy>
            <Arrow />
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

/** The Web's ListFooterLink: a top-divided quiet link inside the card. */
function FooterLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 40,
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderColor: t.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Copy size={12} bold muted>
        {label}
      </Copy>
      <Arrow size={14} />
    </Pressable>
  );
}

function Avatar({ uri, size }: { uri?: string | null; size: number }) {
  const t = useTheme();
  return uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.wash,
      }}
    />
  );
}

function Grid({ children }: { children: ReactNode[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8 }}>
      {children.map((child, index) => (
        <View key={index} style={{ width: "48%", flexGrow: 1 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

function GridSkeleton({ avatar = 28 }: { avatar?: number }) {
  return (
    <Grid>
      {Array.from({ length: 8 }, (_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            minHeight: 52,
          }}
        >
          <Skeleton width={avatar} height={avatar} radius={avatar / 2} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="50%" height={12} />
            <Skeleton width={i % 2 ? "60%" : "80%"} height={10} />
          </View>
        </View>
      ))}
    </Grid>
  );
}

function Toolbar({
  values,
  value,
  onChange,
  note,
}: {
  values: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
  note?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 6,
      }}
    >
      <Filters size="sm" values={values} value={value} onChange={onChange} />
      {!!note && (
        <Copy size={12} muted>
          {note}
        </Copy>
      )}
    </View>
  );
}

export function TrendingStocks({
  youtube,
  reddit,
  loading,
  onOpen,
  onViewAll,
}: {
  youtube: { ticker: string; name: string }[];
  reddit: { ticker: string; name: string }[];
  loading: boolean;
  onOpen: (stock: { ticker: string; name: string }) => void;
  onViewAll: () => void;
}) {
  const t = useTheme();
  const [source, setSource] = useState("youtube");
  const stocks = source === "youtube" ? youtube : reddit;
  return (
    <DiscoverySection title="热议股票" onViewAll={onViewAll}>
      <Glass style={{ padding: 12 }}>
        <Toolbar
          values={[
            ["youtube", "YouTube"],
            ["reddit", "Reddit"],
          ]}
          value={source}
          onChange={setSource}
          note={source === "youtube" ? "按累计观点数" : "过去 24 小时"}
        />
        {stocks.length ? (
          <Grid>
            {stocks.map((stock, index) => (
              <Pressable
                key={stock.ticker}
                accessibilityRole="button"
                accessibilityLabel={`${stock.ticker} ${stock.name}`}
                onPress={() => onOpen(stock)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  minHeight: phone(60),
                  paddingHorizontal: 2,
                  borderRadius: phone(12),
                  backgroundColor: pressed ? t.wash : "transparent",
                })}
              >
                <View style={{ width: 14, alignItems: "center" }}>
                  <Copy size={11} muted localize={false}>
                    {String(index + 1)}
                  </Copy>
                </View>
                <CompanyLogo symbol={stock.ticker} size={24} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Copy size={12} bold lines={1} localize={false}>
                    {stock.ticker}
                  </Copy>
                  <Copy size={11} muted lines={1} localize={false}>
                    {stock.name}
                  </Copy>
                </View>
              </Pressable>
            ))}
          </Grid>
        ) : loading ? (
          <GridSkeleton avatar={24} />
        ) : (
          <Copy size={12} muted>
            暂时没有热议股票。
          </Copy>
        )}
        <FooterLink
          label={
            source === "youtube"
              ? "探索博主的完整观点"
              : "查看 Reddit 完整讨论榜"
          }
          onPress={onViewAll}
        />
      </Glass>
    </DiscoverySection>
  );
}

export type CreatorPick = {
  key: string;
  title: string;
  detail: string;
  avatar?: string | null;
  onPress: () => void;
};

export function DiscoverCreators({
  youtube,
  x,
  loading,
  onViewAll,
}: {
  youtube: CreatorPick[];
  x: CreatorPick[];
  loading: boolean;
  onViewAll: () => void;
}) {
  const t = useTheme();
  const [source, setSource] = useState("youtube");
  const creators = source === "youtube" ? youtube : x;
  return (
    <DiscoverySection title="发现创作者" onViewAll={onViewAll}>
      <Glass style={{ padding: 12 }}>
        <Toolbar
          values={[
            ["youtube", "YouTube"],
            ["x", "X 创作者"],
          ]}
          value={source}
          onChange={setSource}
        />
        {creators.length ? (
          <Grid>
            {creators.map((creator) => (
              <Pressable
                key={creator.key}
                accessibilityRole="button"
                onPress={creator.onPress}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  minHeight: phone(44),
                  paddingVertical: 4,
                  paddingHorizontal: 2,
                  borderRadius: phone(12),
                  backgroundColor: pressed ? t.wash : "transparent",
                })}
              >
                <Avatar uri={creator.avatar} size={24} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Copy size={12} bold lines={1} localize={false}>
                    {creator.title}
                  </Copy>
                  <Copy size={11} muted lines={1} localize={false}>
                    {creator.detail}
                  </Copy>
                </View>
              </Pressable>
            ))}
          </Grid>
        ) : loading ? (
          <GridSkeleton avatar={24} />
        ) : (
          <Copy size={12} muted>
            暂时没有创作者。
          </Copy>
        )}
      </Glass>
    </DiscoverySection>
  );
}

/** Compact rows for the latest research, news and briefs. */
export function LatestRows({
  title,
  rows,
  onViewAll,
  logo,
  multiline = false,
}: {
  title: string;
  rows: (Pick & { ticker?: string; trailing?: string })[];
  onViewAll: () => void;
  logo?: boolean;
  multiline?: boolean;
}) {
  const t = useTheme();
  return (
    <DiscoverySection title={title} onViewAll={onViewAll}>
      <Glass style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
        {rows.map((row, index) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            onPress={row.onPress}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: multiline ? "flex-start" : "center",
              gap: 8,
              minHeight: multiline ? 56 : 44,
              paddingVertical: 8,
              paddingHorizontal: 2,
              borderTopWidth: index ? 1 : 0,
              borderColor: t.border,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            {logo && !!row.ticker && (
              <CompanyLogo symbol={row.ticker} size={24} />
            )}
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Copy
                size={14}
                bold={!multiline}
                lines={multiline ? 2 : 1}
                localize={false}
              >
                {row.title}
              </Copy>
              <Copy size={12} muted lines={1} localize={false}>
                {row.detail}
              </Copy>
            </View>
            {!!row.trailing && (
              <Copy size={12} muted localize={false}>
                {row.trailing}
              </Copy>
            )}
          </Pressable>
        ))}
      </Glass>
    </DiscoverySection>
  );
}
