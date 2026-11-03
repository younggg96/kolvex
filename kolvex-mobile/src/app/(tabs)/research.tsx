import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../state/Auth";
import { usePreferences } from "../../state/Preferences";
import { profile, reports } from "../../lib/contentApi";
import type { TradingAnalysis } from "../../lib/contentTypes";
import { financialFormat } from "../../lib/financialFormat";
import {
  groupResearchByStock,
  loadResearchCatalog,
  STOCKS_PER_PAGE,
} from "../../lib/researchGroups";
import { useText } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import { useResource } from "../../lib/useResource";
import { Pager, ResourceState } from "../../components/Content";
import { Button, Copy, Glass, Page, Search } from "../../components/UI";
export default function Research() {
  const user = useAuth().session?.user.id;
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const account = useResource(`research-profile:${user}`, (signal) =>
    user ? profile(user, signal) : Promise.resolve(null),
  );
  const resource = useResource(
    `research-catalog:${user}`,
    (signal) =>
      loadResearchCatalog((offset) =>
        reports(signal, user ?? "", offset, "", 100),
      ),
    50_000,
  );
  const groups = useMemo(
    () => groupResearchByStock(resource.data ?? []),
    [resource.data],
  );
  const needle = filter.trim().toUpperCase();
  const matched = needle
    ? groups.filter((group) => group.ticker.includes(needle))
    : groups;
  const visible = matched.slice(
    (page - 1) * STOCKS_PER_PAGE,
    page * STOCKS_PER_PAGE,
  );
  return (
    <Page
      title="AI 研究"
      subtitle="沿着证据，读懂不同的判断。"
      refreshing={resource.loading && !!resource.data}
      onRefresh={resource.refresh}
    >
      {account.data?.is_admin && (
        <Button onPress={() => router.push("/research-tasks")}>
          创建研究 / 我的任务
        </Button>
      )}
      <Search
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
      />
      {!!groups.length && (
        <Copy size={12} muted>
          {`按股票 · ${groups.length} 只股票 · ${resource.data?.length ?? 0} 个研究任务`}
        </Copy>
      )}
      <ResourceState
        resource={resource}
        empty={!matched.length}
        message="当前筛选下没有已完成的研究报告。"
      />
      {visible.map((group) => (
        <StockGroup key={group.ticker} {...group} />
      ))}
      {matched.length > STOCKS_PER_PAGE && (
        <Pager
          page={page}
          hasMore={page * STOCKS_PER_PAGE < matched.length}
          loading={resource.loading}
          onChange={setPage}
        />
      )}
      <Copy size={12} muted>
        AI 输出可能存在错误。请结合原始资料自行核实。
      </Copy>
    </Page>
  );
}
function StockGroup({
  ticker,
  tasks,
}: {
  ticker: string;
  tasks: TradingAnalysis[];
}) {
  const t = useTheme();
  const f = financialFormat(usePreferences().locale);
  const text = useText();
  const [open, setOpen] = useState(false);
  const latest = tasks[0];
  return (
    <Glass style={{ overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={{ padding: 20, gap: 8 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Copy size={20} bold localize={false}>
            {ticker}
          </Copy>
          <Copy size={14} muted>
            {open ? "收起" : "展开"}
          </Copy>
        </View>
        <Copy size={12} muted>
          {`${tasks.length} 个研究任务 · ${f.date(`${latest.trade_date}T00:00:00Z`)}`}
        </Copy>
        <Copy size={14} localize={false}>
          {latest.final_decision ? latest.final_decision.slice(0, 240) : "—"}
        </Copy>
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}>
          <Button
            onPress={() => router.push(`/stock/${encodeURIComponent(ticker)}`)}
          >
            {`打开 ${ticker}`}
          </Button>
          {tasks.map((task, index) => (
            <Pressable
              key={task.id}
              accessibilityRole="link"
              onPress={() =>
                router.push(`/report/${encodeURIComponent(task.id)}`)
              }
              style={{
                gap: 4,
                paddingTop: 12,
                minHeight: 44,
                borderTopWidth: 1,
                borderColor: t.border,
              }}
            >
              <Copy size={14} bold localize={false}>
                {f.date(`${task.trade_date}T00:00:00Z`)}
                {index === 0 ? ` · ${text("最新")}` : ""}
              </Copy>
              <Copy size={12} muted localize={false}>
                {[
                  task.author?.full_name || task.author?.username,
                  task.llm_provider,
                  task.duration_seconds != null
                    ? `${Math.round(task.duration_seconds)}s`
                    : null,
                  `#${task.id.slice(0, 8)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Copy>
              <Copy size={13} color={t.accent}>
                阅读报告
              </Copy>
            </Pressable>
          ))}
        </View>
      )}
    </Glass>
  );
}
