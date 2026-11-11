import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { AuthGate, Filters } from "../../../components/Content";
import { Note, useFormat } from "../../../components/SecResearch";
import { CardsSkeleton } from "../../../components/Skeletons";
import {
  ActivityBadge,
  AllocationBar,
  ChangeBreakdown,
  HoldingName,
  InvestorAvatar,
  ShadeDot,
  sumWeights,
  useInvestorByline,
  useQuarterLabel,
} from "../../../components/Superinvestors";
import {
  Button,
  Copy,
  Empty,
  Failure,
  Glass,
  LoadingStatus,
  Page,
  Section,
  styles,
} from "../../../components/UI";
import {
  reportingQuarter,
  type InstitutionManager,
  type InstitutionSummary,
} from "../../../lib/freeResearch";
import {
  forgetInstitutions,
  institutionSummary,
  managers,
} from "../../../lib/freeResearchApi";
import { useTheme } from "../../../lib/theme";
import { useResource } from "../../../lib/useResource";

type Entry = {
  manager: InstitutionManager;
  summary: InstitutionSummary | null;
};
type Loaded = Entry & {
  summary: InstitutionSummary & {
    filing: NonNullable<InstitutionSummary["filing"]>;
  };
};
/**
 * Every summary is a separate request, so one slow SEC read can fail alone
 * without hiding the rest of the directory.
 */
async function loadDirectory(signal: AbortSignal): Promise<Entry[]> {
  const list = await managers(signal);
  const all = list?.managers ?? [];
  const results = await Promise.allSettled(
    all.map((manager) => institutionSummary(manager.id, signal)),
  );
  return all.map((manager, index) => {
    const result = results[index];
    return {
      manager,
      summary: result.status === "fulfilled" ? result.value : null,
    };
  });
}
const changeTotal = (summary: InstitutionSummary) =>
  summary.changes
    ? summary.changes.new +
      summary.changes.increased +
      summary.changes.reduced +
      summary.changes.exited
    : -1;
const bySize = (a: Loaded, b: Loaded) => b.summary.value - a.summary.value;
const open = (id: string) =>
  router.push(`/superinvestor/${encodeURIComponent(id)}`);
const skeleton = (
  <CardsSkeleton
    count={4}
    lines={[
      { size: 16 },
      { size: 12, width: "40%" },
      { size: 20, width: "30%" },
      { size: 12, width: "80%" },
    ]}
  />
);

export default function Superinvestors() {
  return (
    <AuthGate title="超级投资者" skeleton={skeleton}>
      <Directory />
    </AuthGate>
  );
}
function Directory() {
  const f = useFormat();
  const quarterLabel = useQuarterLabel();
  const [sort, setSort] = useState("latest");
  const resource = useResource(
    "superinvestors:directory",
    loadDirectory,
    90_000,
  );
  const refresh = () => {
    forgetInstitutions();
    resource.refresh();
  };
  const entries = resource.data ?? [];
  const loaded = entries.filter((entry): entry is Loaded =>
    Boolean(entry.summary?.filing),
  );
  const failed = entries.filter((entry) => !entry.summary);
  const lead = [...loaded].sort(bySize)[0];
  const totalValue = loaded.reduce(
    (sum, entry) => sum + entry.summary.value,
    0,
  );
  const latestFiled = loaded.reduce<string | null>(
    (latest, entry) =>
      !latest || entry.summary.filing.filed > latest
        ? entry.summary.filing.filed
        : latest,
    null,
  );
  const groups = (() => {
    if (sort === "size")
      return [
        {
          key: "all",
          label: null as string | null,
          items: [...loaded].sort(bySize),
        },
      ];
    if (sort === "activity")
      return [
        {
          key: "all",
          label: null,
          items: [...loaded].sort(
            (a, b) => changeTotal(b.summary) - changeTotal(a.summary),
          ),
        },
      ];
    const byQuarter = new Map<string, Loaded[]>();
    for (const entry of [...loaded].sort((a, b) =>
      b.summary.filing.filed.localeCompare(a.summary.filing.filed),
    )) {
      const q = reportingQuarter(entry.summary.filing.period);
      const key = q ? `${q.year}-${q.quarter}` : "other";
      byQuarter.set(key, [...(byQuarter.get(key) ?? []), entry]);
    }
    return [...byQuarter.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => ({
        key,
        label:
          key === "other"
            ? "其他期间"
            : quarterLabel(items[0].summary.filing.period),
        items,
      }));
  })();
  return (
    <Page
      title="超级投资者"
      onRefresh={refresh}
      refreshing={resource.loading && !!resource.data}
    >
      {resource.loading && !resource.data ? (
        <LoadingStatus label="正在加载最新 13F 申报…">{skeleton}</LoadingStatus>
      ) : resource.error && !resource.data ? (
        <Failure message="投资者申报加载失败" retry={refresh} />
      ) : !entries.length ? (
        <Empty title="暂无内容" message="暂无可用的 13F 申报。" />
      ) : (
        <>
          {lead && <LeadCard entry={lead} />}
          <View style={{ gap: 12 }}>
            <Section
              title={`${entries.length} 位投资者`}
              note={
                loaded.length
                  ? latestFiled
                    ? `合计申报市值 $${f.number(totalValue)} · 最新申报 ${f.date(latestFiled)}`
                    : `合计申报市值 $${f.number(totalValue)}`
                  : undefined
              }
            />
            <Filters
              size="sm"
              values={[
                ["latest", "最新申报"],
                ["size", "规模"],
                ["activity", "调仓最多"],
              ]}
              value={sort}
              onChange={setSort}
            />
          </View>
          {groups.map((group) => (
            <View key={group.key} style={{ gap: 12 }}>
              {!!group.label && (
                <View style={styles.row}>
                  <Copy size={14} bold muted localize={false}>
                    {group.label}
                  </Copy>
                  <Copy size={12} muted>{`${group.items.length} 份申报`}</Copy>
                </View>
              )}
              {group.items.map((entry) => (
                <InvestorCard key={entry.manager.id} entry={entry} />
              ))}
            </View>
          ))}
          {failed.length > 0 && (
            <Glass style={{ padding: 16, gap: 12 }}>
              <Copy size={14} muted>
                {`暂时无法从 SEC 读取 ${failed.map((entry) => entry.manager.name).join("、")} 的申报。`}
              </Copy>
              <Button onPress={refresh} disabled={resource.loading}>
                重试
              </Button>
            </Glass>
          )}
        </>
      )}
      <Note>
        来源：SEC Form 13F-HR，每位投资者最近一份原始申报。13F
        是季度末持仓快照，最晚在季末 45
        天后披露，不代表当前持仓，也不含空头和大部分非美股持仓。投资者为精选名单，并非全部机构。
      </Note>
    </Page>
  );
}
function LeadCard({ entry }: { entry: Loaded }) {
  const t = useTheme();
  const f = useFormat();
  const quarterLabel = useQuarterLabel();
  const byline = useInvestorByline()(entry.manager.id, true);
  const summary = entry.summary;
  const topShare = sumWeights(summary.top);
  const changes = changeTotal(summary);
  return (
    <Glass style={{ padding: 20, gap: 24 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <InvestorAvatar
          id={entry.manager.id}
          name={entry.manager.name}
          size={48}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Copy size={12} muted>
            申报市值最大
          </Copy>
          <Copy size={20} bold localize={false}>
            {entry.manager.name}
          </Copy>
          {!!byline && (
            <Copy size={14} muted localize={false}>
              {byline}
            </Copy>
          )}
          <Copy size={12} muted>
            {`${quarterLabel(summary.filing.period) ?? "—"} · 申报于 ${f.date(summary.filing.filed)}`}
          </Copy>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Stat label="申报市值">{`$${f.number(summary.value)}`}</Stat>
        <Stat label="持仓数">{f.number(summary.positions, false)}</Stat>
        <Stat label="季度变动">
          {changes < 0 ? "—" : f.number(changes, false)}
        </Stat>
      </View>
      {summary.top.length > 0 && (
        <View style={{ gap: 8 }}>
          <View style={styles.row}>
            <Copy
              size={12}
              muted
            >{`前 ${summary.top.length} 大持仓集中度`}</Copy>
            <Copy size={12} bold localize={false}>
              {f.percent(topShare)}
            </Copy>
          </View>
          <AllocationBar
            weights={summary.top.map((row) => row.weight)}
            label={`前 ${summary.top.length} 大持仓占申报市值 ${f.percent(topShare)}`}
          />
        </View>
      )}
      <View
        style={{
          gap: 6,
          paddingTop: 16,
          borderTopWidth: 1,
          borderColor: t.border,
        }}
      >
        <Copy size={12} muted>
          较上季
        </Copy>
        <ChangeBreakdown changes={summary.changes} size={14} />
      </View>
      <View>
        <Copy size={12} muted>{`前 ${summary.top.length} 大持仓`}</Copy>
        {summary.top.map((row, index) => (
          <View
            key={`${row.cusip}-${row.class}-${row.put_call}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 48,
              paddingVertical: 8,
              borderTopWidth: index ? 1 : 0,
              borderColor: t.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                width: 32,
              }}
            >
              <ShadeDot index={index} />
              <Copy size={12} muted localize={false}>
                {index + 1}
              </Copy>
            </View>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <HoldingName row={row} />
              <ActivityBadge kind={row.activity} />
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Copy size={14} bold localize={false}>
                {f.percent(row.weight)}
              </Copy>
              <Copy size={12} muted localize={false}>
                ${f.number(row.value)}
              </Copy>
            </View>
          </View>
        ))}
      </View>
      <Button onPress={() => open(entry.manager.id)}>
        {`查看全部 ${f.number(summary.positions, false)} 个持仓`}
      </Button>
    </Glass>
  );
}
function Stat({ label, children }: { label: string; children: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Copy size={12} muted>
        {label}
      </Copy>
      <Copy size={18} bold localize={false}>
        {children}
      </Copy>
    </View>
  );
}
function InvestorCard({ entry }: { entry: Loaded }) {
  const t = useTheme();
  const f = useFormat();
  const byline = useInvestorByline()(entry.manager.id);
  const summary = entry.summary;
  const first = summary.top[0];
  const topShare = sumWeights(summary.top);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={entry.manager.name}
      onPress={() => open(entry.manager.id)}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      <Glass style={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <InvestorAvatar id={entry.manager.id} name={entry.manager.name} />
          <View style={{ flex: 1, gap: 2 }}>
            <Copy bold lines={1} localize={false}>
              {entry.manager.name}
            </Copy>
            {!!byline && (
              <Copy size={12} lines={1} localize={false}>
                {byline}
              </Copy>
            )}
            <Copy
              size={12}
              muted
            >{`申报于 ${f.date(summary.filing.filed)}`}</Copy>
          </View>
          <Copy muted localize={false}>
            ›
          </Copy>
        </View>
        <View style={[styles.row, { alignItems: "flex-end" }]}>
          <View>
            <Copy size={20} bold localize={false}>
              ${f.number(summary.value)}
            </Copy>
            <Copy size={12} muted>
              申报市值
            </Copy>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Copy size={14} bold localize={false}>
              {f.number(summary.positions, false)}
            </Copy>
            <Copy size={12} muted>
              持仓
            </Copy>
          </View>
        </View>
        {first && (
          <View style={{ gap: 8 }}>
            <AllocationBar
              height={6}
              weights={summary.top.map((row) => row.weight)}
              label={`前 ${summary.top.length} 大持仓占申报市值 ${f.percent(topShare)}`}
            />
            <View style={styles.row}>
              <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
                <Copy size={12} muted>
                  第一大
                </Copy>
                <HoldingName row={first} link={false} size={12} />
              </View>
              <Copy size={12} localize={false}>
                {f.percent(first.weight)}
              </Copy>
            </View>
            <View style={styles.row}>
              <Copy size={12} muted>{`前 ${summary.top.length} 大占比`}</Copy>
              <Copy size={12} localize={false}>
                {f.percent(topShare)}
              </Copy>
            </View>
          </View>
        )}
        <View
          style={{
            borderTopWidth: 1,
            borderColor: t.border,
            paddingTop: 12,
          }}
        >
          <ChangeBreakdown changes={summary.changes} compact />
        </View>
      </Glass>
    </Pressable>
  );
}
