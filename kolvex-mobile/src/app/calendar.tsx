import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { CardsSkeleton } from "../components/Skeletons";
import { useAuth } from "../state/Auth";
import { apiRequest } from "../lib/http";
import { useResource } from "../lib/useResource";
import { Copy, Glass, Page, phone } from "../components/UI";
import { StockBadge } from "../components/StockBadge";
import { AuthGate, Filters, ResourceState } from "../components/Content";
import {
  EVENT_CATEGORIES,
  calendarDays,
  eventOrder,
  eventTime,
  type MarketEvent,
} from "../lib/marketEvents";
import { usePreferences } from "../state/Preferences";
import { useTheme } from "../lib/theme";
import { safeExternal } from "../lib/links";
import { useText } from "../lib/i18n";

type CalendarData = {
  events: MarketEvent[];
  timezone: string;
  today: string;
  start_date: string;
  end_date_exclusive: string;
};

const skeleton = (
  <CardsSkeleton
    lines={[
      { size: 14, width: "40%" },
      { size: 14, lines: 2, width: "80%" },
      { size: 12, width: "50%" },
    ]}
  />
);

export default function Calendar() {
  return (
    <AuthGate title="市场日历" skeleton={skeleton}>
      <Events />
    </AuthGate>
  );
}

function dayLabel(day: string, english: boolean) {
  return new Intl.DateTimeFormat(english ? "en-US" : "zh-CN", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${day}T12:00:00Z`));
}

function Events() {
  const user = useAuth().session!.user.id;
  const t = useTheme();
  const english = usePreferences().locale === "en";
  const [week, setWeek] = useState("1");
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const r = useResource(`events:${user}`, (signal) =>
    apiRequest<CalendarData>("/market/events", {
      signal,
      authenticated: true,
      expectedUser: user,
    }),
  );
  const data = r.data;
  const days = data ? calendarDays(data.start_date, Number(week) * 7) : [];
  const weekEvents = data
    ? data.events.filter((event) => days.includes(event.event_date))
    : [];
  const activeDay =
    data && pickedDay && days.includes(pickedDay)
      ? pickedDay
      : data && days.includes(data.today)
        ? data.today
        : (weekEvents.map((event) => event.event_date).sort()[0] ?? days[0]);
  return (
    <Page title="市场日历" onRefresh={r.refresh} refreshing={r.loading}>
      <ResourceState resource={r} skeleton={skeleton} />
      {data && (
        <>
          <View style={styles.row}>
            <Filters
              size="sm"
              values={[
                ["0", "上周"],
                ["1", "本周"],
                ["2", "下周"],
              ]}
              value={week}
              onChange={setWeek}
            />
            <RefreshButton onPress={r.refresh} disabled={r.loading} />
          </View>
          <Copy size={12} muted localize={false}>
            {`${days[0]} ~ ${days[6]} · ${weekEvents.length} 个事件`}
          </Copy>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: "row", gap: phone(4) }}
          >
            {days.map((day) => {
              const date = new Date(`${day}T12:00:00Z`);
              const selected = day === activeDay;
              const hasEvents = weekEvents.some(
                (event) => event.event_date === day,
              );
              return (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setPickedDay(day)}
                  style={{
                    flex: 1,
                    minHeight: phone(56),
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    borderRadius: phone(16),
                    backgroundColor: selected
                      ? "rgba(255,255,255,0.97)"
                      : "transparent",
                  }}
                >
                  <Copy
                    size={12}
                    color={selected ? "#111111" : t.secondary}
                    localize={false}
                  >
                    {new Intl.DateTimeFormat(english ? "en-US" : "zh-CN", {
                      timeZone: "UTC",
                      weekday: "short",
                    }).format(date)}
                  </Copy>
                  <Copy
                    size={14}
                    bold
                    color={
                      selected
                        ? "#111111"
                        : day === data.today
                          ? t.accent
                          : t.text
                    }
                    localize={false}
                  >
                    {date.getUTCDate()}
                  </Copy>
                  <View
                    style={{
                      width: phone(4),
                      height: phone(4),
                      borderRadius: 2,
                      backgroundColor: hasEvents
                        ? selected
                          ? "#111111"
                          : t.text
                        : "transparent",
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
          <DayCard
            day={activeDay}
            items={weekEvents
              .filter((event) => event.event_date === activeDay)
              .sort(
                (a, b) =>
                  eventOrder(a) - eventOrder(b) || a.id.localeCompare(b.id),
              )}
            today={data.today}
            english={english}
          />
        </>
      )}
    </Page>
  );
}

function DayCard({
  day,
  items,
  today,
  english,
}: {
  day: string;
  items: MarketEvent[];
  today: string;
  english: boolean;
}) {
  const t = useTheme();
  const isToday = day === today;
  return (
    <Glass
      style={{
        padding: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: isToday ? t.accent : t.border,
      }}
    >
      <View style={styles.row}>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            flexShrink: 1,
          }}
        >
          <Copy size={14} bold localize={false}>
            {dayLabel(day, english)}
          </Copy>
          {isToday && (
            <Copy size={14} bold color={t.accent}>
              今天
            </Copy>
          )}
        </View>
        {items.length > 0 && (
          <View
            style={{
              borderRadius: 999,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.border,
              backgroundColor: t.surface,
              paddingHorizontal: phone(8),
              paddingVertical: phone(2),
            }}
          >
            <Copy size={11} muted localize={false}>
              {items.length}
            </Copy>
          </View>
        )}
      </View>
      {!items.length ? (
        <View style={{ alignItems: "center", paddingVertical: phone(24) }}>
          <Copy size={14} muted>
            暂无重点事件
          </Copy>
        </View>
      ) : (
        <View>
          {items.map((event, index) => (
            <EventItem
              key={event.id}
              event={event}
              english={english}
              first={index === 0}
            />
          ))}
        </View>
      )}
    </Glass>
  );
}

function EventItem({
  event,
  english,
  first,
}: {
  event: MarketEvent;
  english: boolean;
  first: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const title = english ? event.title_en || event.title : event.title;
  const summary = english ? event.summary_en || event.summary : event.summary;
  const clamp = summary.length > 160;
  return (
    <View
      style={{
        paddingVertical: phone(12),
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: t.border,
      }}
    >
      <View style={{ gap: phone(8) }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Copy size={12} bold localize={false}>
            {`${eventTime(event, english)} ET`}
          </Copy>
          <Copy size={12} muted>
            {EVENT_CATEGORIES[event.category][english ? 0 : 1]}
          </Copy>
          {event.importance === "high" && (
            <View
              style={{
                borderRadius: 999,
                backgroundColor: t.wash,
                paddingHorizontal: phone(8),
                paddingVertical: phone(2),
              }}
            >
              <Copy size={12}>重大</Copy>
            </View>
          )}
          {event.is_hot && (
            <View
              style={{
                borderRadius: 999,
                backgroundColor: "rgba(255,80,0,0.12)",
                paddingHorizontal: phone(8),
                paddingVertical: phone(2),
              }}
            >
              <Copy size={12} color={t.negative}>
                热门
              </Copy>
            </View>
          )}
        </View>
        {event.tickers.length > 0 && (
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: phone(6) }}
          >
            {event.tickers.map((ticker) => (
              <StockBadge key={ticker} symbol={ticker} />
            ))}
          </View>
        )}
        <Copy size={15} bold selectable localize={false}>
          {title}
        </Copy>
        {!!summary && (
          <View style={{ gap: phone(4) }}>
            <Copy
              size={14}
              lineHeight={24}
              muted
              selectable
              localize={false}
              lines={clamp && !open ? 4 : undefined}
            >
              {summary}
            </Copy>
            {clamp && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setOpen((value) => !value)}
                style={{ alignSelf: "flex-start", paddingVertical: phone(4) }}
              >
                <Copy size={12} muted role="link">
                  {open ? "收起详情" : "事件详情"}
                </Copy>
              </Pressable>
            )}
          </View>
        )}
        {!!event.source_url && (
          <EventSource
            url={event.source_url}
            name={event.source_name || "查看来源"}
          />
        )}
      </View>
    </View>
  );
}

/** The Web's event source line: a small underlined link with ↗. */
function EventSource({ url, name }: { url: string; name: string }) {
  const t = useTheme();
  const text = useText();
  const safe = safeExternal(url);
  if (!safe) return null;
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={8}
      onPress={() => void Linking.openURL(safe).catch(() => undefined)}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          color: t.text,
          fontSize: 11,
          lineHeight: 16,
          textDecorationLine: "underline",
        }}
      >
        {`${text(name)} ↗`}
      </Text>
    </Pressable>
  );
}

/** The Web's MarketRefreshButton: a bordered circle beside the week tabs. */
function RefreshButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  const t = useTheme();
  const size = phone(40);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="刷新日历"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={Math.max(0, (44 - size) / 2)}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
      })}
    >
      <Glass
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolView
          name={{ ios: "arrow.clockwise", android: "refresh", web: "refresh" }}
          size={phone(16)}
          tintColor={t.text}
        />
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
});
