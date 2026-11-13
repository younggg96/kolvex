import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AuthGate, Filters } from "../../../components/Content";
import {
  ContributionBoard,
  MarketOverview,
  ResearchCandidates,
  SESSION_LABELS,
  SummaryCard,
  TickerLevels,
  UnusualContracts,
  type ContractFilter,
} from "../../../components/OptionsActivity";
import { CardsSkeleton } from "../../../components/Skeletons";
import {
  Chip,
  Copy,
  Empty,
  Failure,
  LoadingStatus,
  Page,
} from "../../../components/UI";
import {
  ACTIVITY_SESSIONS,
  type ActivitySession,
} from "../../../lib/optionsActivity";
import { activityRun, activityRuns } from "../../../lib/optionsActivityApi";
import { useResource } from "../../../lib/useResource";
import { useAuth } from "../../../state/Auth";
import { usePreferences } from "../../../state/Preferences";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const skeleton = (
  <>
    <CardsSkeleton
      count={1}
      lines={[
        { size: 20, width: "30%" },
        { size: 15, lines: 3, width: "70%" },
        { size: 12, width: "50%" },
      ]}
    />
    <CardsSkeleton
      count={2}
      lines={[
        { size: 12, width: "30%" },
        { size: 18, width: "40%" },
        { size: 12, width: "30%" },
        { size: 18, width: "40%" },
      ]}
    />
  </>
);

export default function OptionsActivity() {
  return (
    <AuthGate title="期权异动" skeleton={skeleton}>
      <Report />
    </AuthGate>
  );
}
function Report() {
  const user = useAuth().session!.user.id;
  const { locale } = usePreferences();
  const params = useLocalSearchParams<{
    date?: string;
    session?: string;
    kind?: string;
  }>();
  // A shared link can name the day, the run and the contract group.
  const [date, setDate] = useState<string | null>(
    typeof params.date === "string" && DATE.test(params.date)
      ? params.date
      : null,
  );
  const [session, setSession] = useState<ActivitySession | null>(
    ACTIVITY_SESSIONS.find((item) => item === params.session) ?? null,
  );
  const kind: ContractFilter =
    params.kind === "etf" || params.kind === "stock" || params.kind === "earnings"
      ? params.kind
      : "all";
  const list = useResource(
    `options-activity:runs:${user}:${date}`,
    (signal) => activityRuns(date, user, signal),
    25_000,
  );
  const dayRuns = list.data?.runs ?? [];
  // A day with no run picked shows that day's latest run; no day shows the latest of all.
  const picked =
    (session && dayRuns.find((item) => item.session === session)?.id) ||
    (date ? (dayRuns[dayRuns.length - 1]?.id ?? null) : null);
  const waiting = !!(date || session) && !list.data && !list.error;
  const run = useResource(
    `options-activity:run:${user}:${waiting ? "wait" : (picked ?? "latest")}`,
    (signal) =>
      waiting ? Promise.resolve(undefined) : activityRun(picked, user, signal),
    25_000,
  );
  const data = run.data;
  const activeDate = data?.trade_date ?? date ?? list.data?.date ?? null;
  const runsForPicker = date ? dayRuns : (data?.day_runs ?? dayRuns);
  const refresh = () => {
    list.refresh();
    run.refresh();
  };
  const dateLabel = (value: string) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString(
      locale === "en" ? "en-US" : "zh-CN",
      { timeZone: "UTC", month: "short", day: "numeric", weekday: "short" },
    );
  const loading = waiting || (run.loading && !data);
  return (
    <Page
      title="期权异动"
      onRefresh={refresh}
      refreshing={run.loading && !!data}
    >
      <View style={{ gap: 12 }}>
        {!!list.data?.dates.length && (
          <Filters
            values={list.data.dates.map(
              (value) => [value, dateLabel(value)] as const,
            )}
            value={activeDate ?? ""}
            onChange={(next) => {
              setDate(next);
              setSession(null);
            }}
          />
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="运行时点"
          contentContainerStyle={{ gap: 8 }}
        >
          {ACTIVITY_SESSIONS.map((item) => (
            <Chip
              key={item}
              size="sm"
              selected={data?.session === item}
              disabled={!runsForPicker.some((r) => r.session === item)}
              onPress={() => {
                if (!date && activeDate) setDate(activeDate);
                setSession(item);
              }}
            >
              {SESSION_LABELS[item]}
            </Chip>
          ))}
        </ScrollView>
      </View>
      {data ? (
        <>
          <SummaryCard run={data} />
          <ResearchCandidates candidates={data.summary?.candidates} run={data} />
          <MarketOverview run={data} />
          <ContributionBoard run={data} />
          <UnusualContracts key={data.id} run={data} initial={kind} />
          <TickerLevels run={data} />
          <Copy size={12} muted>
            净权利金 = Call 成交额 − Put
            成交额。免费的延迟数据没有主动买卖方向，所以这里反映资金成交在哪里，而不是买入还是卖出。大额
            Put 常常是对冲。这是研究的起点，不是交易信号。
          </Copy>
        </>
      ) : loading ? (
        <LoadingStatus label="正在加载期权异动">{skeleton}</LoadingStatus>
      ) : run.error || list.error ? (
        <Failure message="报告加载失败，请重试。" retry={refresh} />
      ) : (
        <Empty
          title="还没有报告"
          message="交易日美东 09:00、12:30、16:20 定时运行后会出现第一份。"
        />
      )}
    </Page>
  );
}
