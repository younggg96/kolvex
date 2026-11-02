import { useState } from "react";
import { router } from "expo-router";
import { useAuth } from "../state/Auth";
import { briefs } from "../lib/contentApi";
import { useResource } from "../lib/useResource";
import { AuthGate, Filters, Pager, ResourceState } from "../components/Content";
import { Button, Copy, Glass, Page } from "../components/UI";
import { BriefCalendar } from "../components/BriefCalendar";
import { briefNames } from "../lib/contentTypes";
export default function Briefs() {
  return (
    <AuthGate title="市场日报">
      <Library />
    </AuthGate>
  );
}
function Library() {
  const user = useAuth().session!.user.id;
  const [page, setPage] = useState(1);
  const [type, setType] = useState("all");
  const [date, setDate] = useState("");
  const resource = useResource(`${user}:${page}:${type}:${date}`, (signal) =>
    briefs(signal, user, page, type, date),
  );
  const rows = resource.data?.items ?? [];
  return (
    <Page
      title="市场日报"
      subtitle="从盘前到盘后，把重要变化串起来。"
      refreshing={resource.loading && !!resource.data}
      onRefresh={resource.refresh}
    >
      <BriefCalendar
        user={user}
        value={date}
        onChange={(v) => {
          setDate(v);
          setPage(1);
        }}
      />
      <Filters
        values={[
          ["all", "全部"],
          ["morning", "盘前"],
          ["intraday", "盘中"],
          ["evening", "盘后"],
        ]}
        value={type}
        onChange={(v) => {
          setType(v);
          setPage(1);
        }}
      />
      <ResourceState
        resource={resource}
        empty={!rows.length}
        message="此分类下暂无已发布的日报。"
      />
      {rows.map((item) => (
        <Glass key={item.id} style={{ padding: 20, gap: 12 }}>
          <Copy size={12} muted>
            {item.brief_date} · {briefNames[item.brief_type]}
          </Copy>
          <Copy size={20} bold>
            {item.title}
          </Copy>
          <Copy>{item.headline}</Copy>
          <Button
            onPress={() => router.push(`/brief/${encodeURIComponent(item.id)}`)}
          >
            阅读日报
          </Button>
        </Glass>
      ))}
      <Pager
        page={page}
        hasMore={page * 10 < (resource.data?.total ?? 0)}
        loading={resource.loading}
        onChange={setPage}
      />
    </Page>
  );
}
