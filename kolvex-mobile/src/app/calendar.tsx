import { useState } from "react";
import { View } from "react-native";
import { useAuth } from "../state/Auth";
import { apiRequest } from "../lib/http";
import { useResource } from "../lib/useResource";
import { Page, Glass, Copy, Button } from "../components/UI";
import {
  AuthGate,
  Filters,
  ResourceState,
  SourceLink,
} from "../components/Content";
import { router } from "expo-router";
import {
  EVENT_CATEGORIES,
  eventTime,
  type MarketEvent,
} from "../lib/marketEvents";
import { usePreferences } from "../state/Preferences";
import { useTheme } from "../lib/theme";
export default function Calendar() {
  return (
    <AuthGate title="市场日历">
      <Events />
    </AuthGate>
  );
}
function Events() {
  const user = useAuth().session!.user.id;
  const t = useTheme();
  const english = usePreferences().locale === "en";
  const [category, setCategory] = useState("all");
  const r = useResource(`events:${user}`, (signal) =>
    apiRequest<{
      events: MarketEvent[];
      timezone: string;
      start_date: string;
      end_date_exclusive: string;
    }>("/market/events", { signal, authenticated: true, expectedUser: user }),
  );
  const events = (r.data?.events || []).filter(
    (e) => category === "all" || e.category === category,
  );
  return (
    <Page
      title="市场日历"
      subtitle="财报、宏观与政策事件。"
      onRefresh={r.refresh}
      refreshing={r.loading}
    >
      <Filters
        values={[
          ["all", "全部"],
          ["earnings", "财报"],
          ["fed", "美联储"],
          ["economic", "经济数据"],
          ["other", "其他"],
        ]}
        value={category}
        onChange={setCategory}
      />
      <Copy muted>
        {r.data?.timezone || "America/New_York"} · {r.data?.start_date} —{" "}
        {r.data?.end_date_exclusive}（不含结束日）
      </Copy>
      <ResourceState
        resource={r}
        empty={!events.length}
        message="此范围没有市场事件"
      />
      {events.map((e) => (
        <Glass key={e.id} style={{ padding: 20, gap: 12 }}>
          <Copy bold localize={false}>
            {english ? e.title_en || e.title : e.title}
          </Copy>
          <Copy muted localize={false}>
            {e.event_date} · {eventTime(e, english)} ET ·{" "}
            {EVENT_CATEGORIES[e.category][english ? 0 : 1]}
          </Copy>
          {(e.importance === "high" || e.is_hot) && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {e.importance === "high" && (
                <Copy size={12} bold>
                  重大
                </Copy>
              )}
              {e.is_hot && (
                <Copy size={12} bold color={t.negative}>
                  热门
                </Copy>
              )}
            </View>
          )}
          <Copy selectable localize={false}>
            {english ? e.summary_en || e.summary : e.summary}
          </Copy>
          {e.tickers.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {e.tickers.map((ticker) => (
                <Button
                  key={ticker}
                  onPress={() =>
                    router.push(`/stock/${encodeURIComponent(ticker)}`)
                  }
                >
                  {ticker}
                </Button>
              ))}
            </View>
          )}
          {e.source_url && (
            <SourceLink url={e.source_url}>
              {e.source_name || "查看来源"}
            </SourceLink>
          )}
        </Glass>
      ))}
    </Page>
  );
}
