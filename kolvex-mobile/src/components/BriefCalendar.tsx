import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  dateKey,
  editionNames,
  isWeekendBriefDate,
  shiftBriefDate,
  utcBriefDate,
} from "../lib/briefDates";
import { BRIEF_TYPES } from "../lib/contentTypes";
import { apiRequest } from "../lib/http";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { Button, Copy, Glass, phone } from "./UI";

export function BriefIconButton({
  label,
  icon,
  onPress,
  glass = true,
  disabled = false,
}: {
  label: string;
  icon: SymbolViewProps["name"];
  onPress: () => void;
  glass?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const text = useText();
  const size = phone(36);
  const glyph = <SymbolView name={icon} size={phone(16)} tintColor={t.text} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text(label)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={Math.max(0, (44 - size) / 2)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.center,
        {
          width: size,
          height: size,
          opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
        },
      ]}
    >
      {glass ? (
        <Glass
          style={[
            styles.center,
            { width: size, height: size, borderRadius: 999 },
          ]}
        >
          {glyph}
        </Glass>
      ) : (
        glyph
      )}
    </Pressable>
  );
}

const left = {
  ios: "chevron.left",
  android: "chevron_left",
  web: "chevron_left",
} as const;
const right = {
  ios: "chevron.right",
  android: "chevron_right",
  web: "chevron_right",
} as const;
const monthLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);

export function BriefCalendar({
  user,
  value,
  today,
  onChange,
  onClose,
}: {
  user: string;
  value: string;
  today: string;
  onChange: (date: string) => void;
  onClose: () => void;
}) {
  const { locale } = usePreferences();
  const region = locale === "zh" ? "zh-CN" : "en-US";
  const text = useText();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(value.slice(0, 7));
  const r = useResource(`brief-calendar:${user}:${month}`, (signal) =>
    apiRequest<{ days: { date: string; types: string[] }[] }>(
      `/briefs/calendar?month=${encodeURIComponent(month)}`,
      { signal, authenticated: true, expectedUser: user },
    ),
  );
  const availability = new Map(
    r.data?.days.map((day) => [day.date, day.types]),
  );
  const first = utcBriefDate(`${month}-01`);
  const weekStart = locale === "zh" ? 1 : 0;
  const leading = (first.getUTCDay() - weekStart + 7) % 7;
  const weekday = new Intl.DateTimeFormat(region, {
    weekday: "narrow",
    timeZone: "UTC",
  });
  const fullDate = new Intl.DateTimeFormat(region, {
    dateStyle: "long",
    timeZone: "UTC",
  });
  const week = Array.from({ length: 7 }, (_, index) =>
    weekday.format(utcBriefDate(`2024-01-0${index + 1}`)),
  );
  if (weekStart === 0) week.unshift(week.pop()!);

  function moveMonth(offset: number) {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth() + offset);
    setMonth(dateKey(next).slice(0, 7));
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 16,
          paddingTop: insets.top + phone(84),
          paddingBottom: insets.bottom,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text("关闭")}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={{ flexShrink: 1 }}>
          <Glass material style={{ padding: 16, gap: 16 }}>
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: t.dark
                    ? "rgba(0,0,0,0.68)"
                    : "rgba(255,255,255,0.68)",
                },
              ]}
            />
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ gap: phone(16) }}>
                <Copy size={14} bold>
                  简报日历
                </Copy>
                <View
                  style={[
                    styles.row,
                    {
                      width: phone(240),
                      maxWidth: "100%",
                      alignSelf: "center",
                      justifyContent: "space-between",
                    },
                  ]}
                >
                  <BriefIconButton
                    label="上个月"
                    icon={left}
                    onPress={() => moveMonth(-1)}
                  />
                  <Copy size={14} bold localize={false}>
                    {monthLabel(first, region)}
                  </Copy>
                  <BriefIconButton
                    label="下个月"
                    icon={right}
                    onPress={() => moveMonth(1)}
                  />
                </View>
                <View
                  style={{
                    alignSelf: "center",
                    width: "100%",
                    maxWidth: phone(280),
                  }}
                >
                  <View style={styles.row}>
                    {week.map((day, index) => (
                      <View key={index} style={styles.cell}>
                        <Copy size={12} muted localize={false}>
                          {day}
                        </Copy>
                      </View>
                    ))}
                  </View>
                  {Array.from({ length: 6 }, (_, row) => (
                    <View key={row} style={styles.row}>
                      {week.map((_, column) => {
                        const date = shiftBriefDate(
                          `${month}-01`,
                          row * 7 + column - leading,
                        );
                        if (!date.startsWith(month))
                          return <View key={date} style={styles.cell} />;
                        const selected = date === value;
                        const available = BRIEF_TYPES.filter((type) =>
                          availability.get(date)?.includes(type),
                        );
                        const weekend = isWeekendBriefDate(date);
                        const ink = selected ? t.background : t.text;
                        const status = r.loading
                          ? text("正在读取简报日期…")
                          : r.error
                            ? text("日期标记加载失败。")
                            : available.length
                              ? weekend
                                ? text("周末简报")
                                : available
                                    .map((type) => text(editionNames[type]))
                                    .join(" / ")
                              : text("暂无简报");
                        return (
                          <Pressable
                            key={date}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${fullDate.format(utcBriefDate(date))}，${status}`}
                            onPress={() => onChange(date)}
                            style={[
                              styles.cell,
                              {
                                borderRadius: 999,
                                backgroundColor: selected ? t.text : undefined,
                              },
                            ]}
                          >
                            <Copy
                              size={14}
                              bold={selected}
                              color={ink}
                              localize={false}
                            >
                              {Number(date.slice(8))}
                            </Copy>
                            {available.length > 0 && (
                              <View
                                style={{
                                  flexDirection: "row",
                                  gap: phone(3),
                                  position: "absolute",
                                  bottom: phone(3),
                                }}
                              >
                                {(weekend ? ["evening"] : available).map(
                                  (type) => (
                                    <View
                                      key={type}
                                      style={{
                                        width: phone(4),
                                        height: phone(4),
                                        borderRadius:
                                          type === "intraday" ? 0 : phone(3),
                                        backgroundColor:
                                          type === "evening"
                                            ? "transparent"
                                            : ink,
                                        borderWidth: type === "evening" ? 1 : 0,
                                        borderColor: ink,
                                      }}
                                    />
                                  ),
                                )}
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
                <View
                  style={[
                    styles.row,
                    {
                      justifyContent: "center",
                      flexWrap: "wrap",
                      gap: phone(8),
                    },
                  ]}
                >
                  {!isWeekendBriefDate(value) && (
                    <>
                      <Copy size={12} muted>
                        ● {editionNames.morning}
                      </Copy>
                      <Copy size={12} muted>
                        ▪ {editionNames.intraday}
                      </Copy>
                      <Copy size={12} muted>
                        ○ {editionNames.evening}
                      </Copy>
                    </>
                  )}
                  <Copy size={12} muted>
                    周末每天一篇，不分盘前、盘中或盘后
                  </Copy>
                </View>
                <View accessibilityLiveRegion="polite" style={styles.center}>
                  <Copy size={12} muted>
                    {r.loading
                      ? "正在读取简报日期…"
                      : r.error
                        ? "日期标记加载失败。"
                        : "日期按美西时间显示"}
                  </Copy>
                  {!!r.error && <Button onPress={r.refresh}>重试</Button>}
                </View>
                <View style={styles.center}>
                  <Button onPress={() => onChange(today)} block>
                    今天
                  </Button>
                </View>
              </View>
            </ScrollView>
          </Glass>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  center: { alignItems: "center", justifyContent: "center" },
  cell: {
    flex: 1,
    height: phone(36),
    justifyContent: "center",
    alignItems: "center",
  },
});
