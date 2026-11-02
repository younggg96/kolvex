import { useState } from "react";
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
type Event = {
  id: string;
  title: string;
  summary: string;
  category: string;
  event_date: string;
  starts_at?: string;
  timing: string;
  tickers: string[];
  importance: string;
  source_url?: string;
  source_name: string;
  status: string;
};
export default function Calendar() {
  return (
    <AuthGate title="市场日历">
      <Events />
    </AuthGate>
  );
}
function Events() {
  const user = useAuth().session!.user.id;
  const [category, setCategory] = useState("all");
  const r = useResource(`events:${user}`, (signal) =>
    apiRequest<{
      events: Event[];
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
          <Copy bold>{e.title}</Copy>
          <Copy muted>
            {e.event_date} · {e.starts_at || e.timing} · {e.importance} ·{" "}
            {e.status}
          </Copy>
          <Copy selectable>{e.summary}</Copy>
          {e.tickers.map((t) => (
            <Button
              key={t}
              onPress={() => router.push(`/stock/${encodeURIComponent(t)}`)}
            >
              {t}
            </Button>
          ))}
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
