import { useState } from "react";
import { Image, Pressable, View, type ImageSourcePropType } from "react-native";
import { router } from "expo-router";
import {
  reportingQuarter,
  type HoldingActivity,
  type InstitutionSummary,
} from "../lib/freeResearch";
import profiles from "../lib/investorProfiles.json";
import { useTheme } from "../lib/theme";
import { usePreferences } from "../state/Preferences";
import { useFormat } from "./SecResearch";
import { Copy } from "./UI";

export const ACTIVITY_LABELS: Record<HoldingActivity, string> = {
  new: "新建仓",
  increased: "增持",
  reduced: "减持",
  exited: "清仓",
  unchanged: "不变",
  unknown: "未比较",
};
const ACTIVITY_GLYPH: Record<HoldingActivity, string> = {
  new: "+",
  increased: "↑",
  reduced: "↓",
  exited: "×",
  unchanged: "–",
  unknown: "–",
};
export function useActivityColor() {
  const t = useTheme();
  return (kind: HoldingActivity) =>
    kind === "new" || kind === "increased"
      ? t.accent
      : kind === "reduced" || kind === "exited"
        ? t.negative
        : t.secondary;
}
/** Written label plus glyph, so direction never rests on color alone. */
export function ActivityBadge({ kind }: { kind: HoldingActivity }) {
  const t = useTheme();
  const color = useActivityColor()(kind);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: t.tint,
      }}
    >
      <Copy size={12} bold color={color} localize={false}>
        {ACTIVITY_GLYPH[kind]}
      </Copy>
      <Copy size={12} bold color={color}>
        {ACTIVITY_LABELS[kind]}
      </Copy>
    </View>
  );
}
/** `2026 年第 2 季度` / `Q2 2026` for a 13F reporting period. */
export function useQuarterLabel() {
  const { locale } = usePreferences();
  return (period: string | null | undefined) => {
    const q = reportingQuarter(period);
    if (!q) return null;
    return locale === "en"
      ? `Q${q.quarter} ${q.year}`
      : `${q.year} 年第 ${q.quarter} 季度`;
  };
}
// Ranked shades mark rank, not direction, so they stay neutral.
const SHADES = [0.85, 0.65, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.12, 0.1];
export const shadeFor = (index: number) =>
  SHADES[Math.min(index, SHADES.length - 1)];
export function ShadeDot({ index }: { index: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: t.text,
        opacity: shadeFor(index),
      }}
    />
  );
}
/** One pill track showing how much of the book the top holdings take. */
export function AllocationBar({
  weights,
  label,
  height = 8,
}: {
  weights: (number | null)[];
  label: string;
  height?: number;
}) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        gap: 1,
        height,
        borderRadius: height / 2,
        overflow: "hidden",
        backgroundColor: t.tint,
      }}
    >
      {weights.map((weight, index) =>
        weight && weight > 0 ? (
          <View
            key={index}
            style={{
              width: `${Math.min(weight, 1) * 100}%`,
              backgroundColor: t.text,
              opacity: shadeFor(index),
            }}
          />
        ) : null,
      )}
    </View>
  );
}
export const sumWeights = (rows: { weight: number | null }[]) =>
  rows.reduce((sum, row) => sum + (row.weight ?? 0), 0);

/** New / added / reduced / exited counts, each with its written label. */
export function ChangeBreakdown({
  changes,
}: {
  changes: InstitutionSummary["changes"];
}) {
  const f = useFormat();
  const color = useActivityColor();
  const t = useTheme();
  if (!changes)
    return (
      <Copy size={12} muted>
        未比较季度变化
      </Copy>
    );
  const items: [HoldingActivity, number][] = [
    ["new", changes.new],
    ["increased", changes.increased],
    ["reduced", changes.reduced],
    ["exited", changes.exited],
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: 12,
        rowGap: 4,
      }}
    >
      {items.map(([kind, count]) => (
        <View key={kind} style={{ flexDirection: "row", gap: 4 }}>
          <Copy size={12} muted>
            {ACTIVITY_LABELS[kind]}
          </Copy>
          <Copy
            size={12}
            bold
            localize={false}
            color={count ? color(kind) : t.secondary}
          >
            {f.number(count, false)}
          </Copy>
        </View>
      ))}
    </View>
  );
}

type Bilingual = { en: string; zh: string };
/** Same curated list as the Web's INVESTOR_PROFILES; ids match the backend MANAGERS. */
export const INVESTOR_PROFILES: Record<
  string,
  { zhName: string; person: Bilingual; role: Bilingual }
> = profiles;
const LOGOS: Record<string, ImageSourcePropType> = {
  berkshire: require("../../assets/superinvestors/berkshire.png"),
  bridgewater: require("../../assets/superinvestors/bridgewater.png"),
  pershing: require("../../assets/superinvestors/pershing.png"),
  tiger: require("../../assets/superinvestors/tiger.png"),
  oaktree: require("../../assets/superinvestors/oaktree.png"),
  renaissance: require("../../assets/superinvestors/renaissance.png"),
};
/** Secondary identity line: Chinese firm name (zh only) and the investor behind it. */
export function useInvestorByline() {
  const { locale } = usePreferences();
  return (id: string, withRole = false) => {
    const profile = INVESTOR_PROFILES[id];
    if (!profile) return null;
    if (locale === "en")
      return withRole
        ? `${profile.person.en}, ${profile.role.en}`
        : profile.person.en;
    return [profile.zhName, profile.person.zh, withRole ? profile.role.zh : ""]
      .filter(Boolean)
      .join(" · ");
  };
}
/** Firm mark when one is bundled, otherwise a neutral monogram. */
export function InvestorAvatar({
  id,
  name,
  size = 40,
}: {
  id: string;
  name: string;
  size?: number;
}) {
  const t = useTheme();
  const logo = LOGOS[id];
  const [failed, setFailed] = useState(false);
  const letters = name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: logo && !failed ? "#FFFFFF" : t.tint,
        borderWidth: logo && !failed ? 1 : 0,
        borderColor: t.border,
      }}
    >
      {logo && !failed ? (
        <Image
          source={logo}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Copy size={Math.round(size * 0.36)} bold localize={false}>
          {letters || "·"}
        </Copy>
      )}
    </View>
  );
}

export interface HoldingIdentityRow {
  issuer: string;
  ticker?: string | null;
  class?: string | null;
  put_call?: string | null;
}
/**
 * A 13F row as a stock: ticker when OpenFIGI mapped one, the filed issuer name
 * otherwise, so nothing is dropped or guessed. A mapped row opens its stock page.
 */
export function HoldingName({
  row,
  detail = false,
  link = true,
  size = 14,
}: {
  row: HoldingIdentityRow;
  detail?: boolean;
  link?: boolean;
  size?: number;
}) {
  const t = useTheme();
  const ticker = row.ticker || null;
  const subtitle = ticker
    ? [row.issuer, row.class].filter(Boolean).join(" · ")
    : row.class;
  const body = (
    <View style={{ flexShrink: 1, gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ flexShrink: 1 }}>
          <Copy size={size} bold={!!ticker} lines={1} localize={false}>
            {ticker ?? row.issuer}
          </Copy>
        </View>
        {!!row.put_call && (
          <View
            style={{
              paddingHorizontal: 6,
              borderRadius: 999,
              backgroundColor: t.tint,
            }}
          >
            <Copy size={11} bold>
              {row.put_call.toUpperCase() === "PUT" ? "看跌" : "看涨"}
            </Copy>
          </View>
        )}
      </View>
      {detail && !!subtitle && (
        <Copy size={12} muted lines={1} localize={false}>
          {subtitle}
        </Copy>
      )}
    </View>
  );
  if (!ticker || !link) return body;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[ticker, row.issuer].join(" · ")}
      hitSlop={8}
      onPress={() => router.push(`/stock/${encodeURIComponent(ticker)}`)}
      style={({ pressed }) => ({
        flexShrink: 1,
        minHeight: detail ? 44 : undefined,
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {body}
    </Pressable>
  );
}
