import { useMemo, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AuthGate, Field, Filters } from "../../components/Content";
import {
  Note,
  SecLink,
  SEC_TIMEOUT,
  useFormat,
} from "../../components/SecResearch";
import { CardsSkeleton } from "../../components/Skeletons";
import {
  ACTIVITY_LABELS,
  ActivityBadge,
  AllocationBar,
  ChangeBreakdown,
  HoldingName,
  InvestorAvatar,
  ShadeDot,
  sumWeights,
  useInvestorByline,
  useQuarterLabel,
} from "../../components/Superinvestors";
import {
  Button,
  Chip,
  Copy,
  Empty,
  Failure,
  Glass,
  LoadingStatus,
  Page,
  Section,
  styles,
} from "../../components/UI";
import type { HoldingActivity, Institution } from "../../lib/freeResearch";
import {
  forgetInstitutions,
  institution,
  managers,
} from "../../lib/freeResearchApi";
import { useTheme } from "../../lib/theme";
import { useResource } from "../../lib/useResource";

type Holding = Institution["holdings"][number];
type Filter = "all" | Exclude<HoldingActivity, "unknown">;
type SortKey = "value" | "shares" | "change";
const PAGE = 50;
const TOP = 10;
const FILTERS: Filter[] = [
  "all",
  "new",
  "increased",
  "reduced",
  "exited",
  "unchanged",
];
const SORTS: [SortKey, string][] = [
  ["value", "市值"],
  ["shares", "股数"],
  ["change", "股数变化"],
];
const rowKey = (row: Holding) =>
  `${row.cusip}-${row.class}-${row.share_type}-${row.put_call}`;
const sortValue = (row: Holding, key: SortKey) =>
  key === "value"
    ? row.value
    : key === "shares"
      ? row.shares
      : row.change_percent;
const skeleton = (
  <>
    <CardsSkeleton
      count={1}
      padding={16}
      gap={8}
      lines={[
        { size: 12, width: "30%" },
        { size: 16, width: "40%" },
        { size: 12, width: "30%" },
        { size: 16, width: "40%" },
      ]}
    />
    <CardsSkeleton count={2} lines={[{ size: 14, lines: 5, width: "70%" }]} />
  </>
);

export default function SuperinvestorDetail() {
  return (
    <AuthGate title="超级投资者" skeleton={skeleton}>
      <Detail />
    </AuthGate>
  );
}
function Detail() {
  const { manager: raw } = useLocalSearchParams<{ manager: string }>();
  const manager = String(raw ?? "");
  const f = useFormat();
  const quarterLabel = useQuarterLabel();
  const byline = useInvestorByline()(manager, true);
  const list = useResource(
    "sec-managers",
    (signal) => managers(signal),
    SEC_TIMEOUT,
  );
  // Same cache key as the stock Ownership tab, so both share one SEC read.
  const resource = useResource(
    `sec-institution:${manager}`,
    (signal) => institution(manager, signal),
    SEC_TIMEOUT,
  );
  const identity = list.data?.managers.find((item) => item.id === manager);
  const unknown = !!list.data && !identity;
  const data = resource.data;
  const holdings = useMemo(() => data?.holdings ?? [], [data]);
  const held = holdings.filter((row) => row.activity !== "exited");
  const totalValue = held.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const filing = data?.filing;
  const refresh = () => {
    forgetInstitutions();
    list.refresh();
    resource.refresh();
  };
  if (unknown)
    return (
      <Page title="超级投资者">
        <Empty title="未收录该投资者" message="该投资者不在精选名单中。" />
        <Button onPress={() => router.replace("/superinvestors")}>
          返回全部投资者
        </Button>
      </Page>
    );
  return (
    <Page
      title={identity?.name ?? data?.name ?? "超级投资者"}
      titleLocalize={!(identity?.name ?? data?.name)}
      subtitle={byline ?? undefined}
      subtitleLocalize={false}
      onRefresh={refresh}
      refreshing={resource.loading && !!data}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <InvestorAvatar id={manager} name={identity?.name ?? ""} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Copy size={14} muted>
            {filing
              ? `13F 持仓 · ${quarterLabel(filing.period) ?? "—"} 申报于 ${f.date(filing.filed)}`
              : "13F 持仓"}
          </Copy>
          {identity && (
            <Copy size={12} muted localize={false}>
              CIK {identity.cik}
            </Copy>
          )}
        </View>
      </View>
      {resource.loading && !data ? (
        <LoadingStatus label="正在从 SEC 读取这份 13F 申报…">
          {skeleton}
        </LoadingStatus>
      ) : resource.error && !data ? (
        <Failure message="13F 持仓加载失败，请重试。" retry={refresh} />
      ) : !holdings.length || !data?.filing ? (
        <Empty title="暂无数据" message="这家机构暂无可用的 13F 持仓。" />
      ) : (
        <>
          <Overview data={data} held={held} totalValue={totalValue} />
          <Allocation held={held} />
          <QuarterActivity data={data} />
          <Holdings key={manager} data={data} />
        </>
      )}
      <Note>
        来源：SEC Form 13F-HR。这是季度末持仓快照，最晚在季末 45
        天后才披露，不代表当前持仓，也不含空头和大部分非美股持仓。股数变化未按拆股调整，仅比较相邻两个季度。投资机构为精选名单。
      </Note>
    </Page>
  );
}
function Overview({
  data,
  held,
  totalValue,
}: {
  data: Institution;
  held: Holding[];
  totalValue: number;
}) {
  const t = useTheme();
  const f = useFormat();
  const quarterLabel = useQuarterLabel();
  const filing = data.filing!;
  const largest = [...held].sort(
    (a, b) => (b.weight ?? 0) - (a.weight ?? 0),
  )[0];
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          rowGap: 20,
          borderBottomWidth: 1,
          borderColor: t.border,
          paddingBottom: 24,
        }}
      >
        <OverviewStat label="申报市值">{`$${f.number(totalValue)}`}</OverviewStat>
        <OverviewStat label="持仓数">
          {f.number(held.length, false)}
        </OverviewStat>
        <OverviewStat
          label="第一大持仓"
          hint={largest ? <HoldingName row={largest} size={14} /> : undefined}
        >
          {f.percent(largest?.weight)}
        </OverviewStat>
        <OverviewStat
          label="持仓截止日"
          hint={quarterLabel(filing.period) ?? undefined}
        >
          {f.date(filing.period)}
        </OverviewStat>
        <OverviewStat label="申报日" hint={filing.form}>
          {f.date(filing.filed)}
        </OverviewStat>
      </View>
      <SecLink href={filing.source_url} label="在 SEC 查看原始申报 ↗" />
    </View>
  );
}
function OverviewStat({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: string;
}) {
  return (
    <View style={{ width: "50%", paddingRight: 24, gap: 4 }}>
      <Copy size={12} muted>
        {label}
      </Copy>
      <Copy size={18} bold localize={false}>
        {children}
      </Copy>
      {!!hint &&
        (typeof hint === "string" ? (
          <Copy size={12} muted localize={false}>
            {hint}
          </Copy>
        ) : (
          <View style={{ flexShrink: 1 }}>{hint}</View>
        ))}
    </View>
  );
}
function Allocation({ held }: { held: Holding[] }) {
  const f = useFormat();
  const top = [...held]
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, TOP);
  const share = sumWeights(top);
  return (
    <Glass style={{ padding: 20, gap: 16 }}>
      <View style={styles.row}>
        <Copy size={14} bold>
          持仓集中度
        </Copy>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Copy size={12} muted>{`前 ${top.length} 大`}</Copy>
          <Copy size={14} bold localize={false}>
            {f.percent(share)}
          </Copy>
        </View>
      </View>
      <AllocationBar
        height={10}
        weights={top.map((row) => row.weight)}
        label={`前 ${top.length} 大持仓占申报市值 ${f.percent(share)}`}
      />
      <View>
        {top.map((row, index) => (
          <View
            key={rowKey(row)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              minHeight: 36,
            }}
          >
            <ShadeDot index={index} />
            <View style={{ width: 16 }}>
              <Copy size={12} muted localize={false}>
                {index + 1}
              </Copy>
            </View>
            <View style={{ flex: 1, alignItems: "flex-start" }}>
              <HoldingName row={row} size={12} />
            </View>
            <Copy size={12} localize={false}>
              {f.percent(row.weight)}
            </Copy>
          </View>
        ))}
      </View>
      {held.length > top.length && (
        <Copy size={12} muted>
          {`其余 ${f.number(held.length - top.length, false)} 个持仓合计 ${f.percent(Math.max(0, 1 - share))}。`}
        </Copy>
      )}
    </Glass>
  );
}
const BUYS: HoldingActivity[] = ["new", "increased"];
const SELLS: HoldingActivity[] = ["reduced", "exited"];
function QuarterActivity({ data }: { data: Institution }) {
  const f = useFormat();
  const holdings = data.holdings;
  const count = (kind: HoldingActivity) =>
    holdings.filter((row) => row.activity === kind).length;
  const compared = holdings.some((row) => row.activity !== "unknown");
  const changes = compared
    ? {
        new: count("new"),
        increased: count("increased"),
        reduced: count("reduced"),
        exited: count("exited"),
      }
    : null;
  const rank = (row: Holding) => row.value ?? 0;
  const buys = holdings
    .filter((row) => BUYS.includes(row.activity))
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 4);
  // Exited rows hold nothing now; they fall back to last quarter's share count.
  const sells = holdings
    .filter((row) => SELLS.includes(row.activity))
    .sort(
      (a, b) =>
        rank(b) - rank(a) ||
        (b.previous_shares ?? 0) - (a.previous_shares ?? 0),
    )
    .slice(0, 4);
  const previous = data.previous_filing;
  return (
    <Glass style={{ padding: 20, gap: 16 }}>
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        <Copy size={14} bold>
          较上季变动
        </Copy>
        {previous && (
          <SecLink
            href={previous.source_url}
            label={`上季申报 ${f.date(previous.filed)}`}
          />
        )}
      </View>
      <ChangeBreakdown changes={changes} size={14} />
      {changes ? (
        <>
          <MoveList title="主要买入" rows={buys} empty="本季无买入" />
          <MoveList title="主要卖出" rows={sells} empty="本季无卖出" />
        </>
      ) : (
        <Copy size={12} muted>
          无法与上季比较，因此不列出买入和卖出。
        </Copy>
      )}
    </Glass>
  );
}
function MoveList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Holding[];
  empty: string;
}) {
  const t = useTheme();
  const f = useFormat();
  return (
    <View>
      <View
        style={{
          borderBottomWidth: 1,
          borderColor: t.border,
          paddingBottom: 8,
        }}
      >
        <Copy size={12} muted>
          {title}
        </Copy>
      </View>
      {rows.length ? (
        rows.map((row, index) => (
          <View
            key={rowKey(row)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              minHeight: 44,
              paddingVertical: 6,
              borderBottomWidth: index === rows.length - 1 ? 0 : 1,
              borderColor: t.border,
            }}
          >
            <View style={{ flex: 1, alignItems: "flex-start" }}>
              <HoldingName row={row} size={12} />
            </View>
            <ActivityBadge kind={row.activity} />
            <View style={{ minWidth: 56, alignItems: "flex-end" }}>
              <Copy size={12} muted localize={false}>
                {row.activity === "new" || row.activity === "exited"
                  ? `$${f.number(row.value ?? 0)}`
                  : f.percent(row.change_percent)}
              </Copy>
            </View>
          </View>
        ))
      ) : (
        <Copy size={12} muted>
          {empty}
        </Copy>
      )}
    </View>
  );
}
function Holdings({ data }: { data: Institution }) {
  const t = useTheme();
  const f = useFormat();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "value",
    dir: "desc",
  });
  const [visible, setVisible] = useState(PAGE);
  const holdings = data.holdings;
  const counts = Object.fromEntries(
    FILTERS.map((kind) => [
      kind,
      kind === "all"
        ? holdings.length
        : holdings.filter((row) => row.activity === kind).length,
    ]),
  ) as Record<Filter, number>;
  const needle = query.trim().toUpperCase();
  const filtered = holdings
    .filter((row) => filter === "all" || row.activity === filter)
    .filter(
      (row) =>
        !needle ||
        row.ticker?.toUpperCase().startsWith(needle) ||
        row.issuer.toUpperCase().includes(needle) ||
        row.cusip?.includes(needle),
    )
    .sort((a, b) => {
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return sort.dir === "desc" ? y - x : x - y;
    });
  const rows = filtered.slice(0, visible);
  const maxWeight = Math.max(...holdings.map((row) => row.weight ?? 0), 0.0001);
  const ranks = new Map(
    [...holdings]
      .filter((row) => row.activity !== "exited")
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .map((row, index) => [rowKey(row), index + 1]),
  );
  return (
    <View style={{ gap: 16 }}>
      <Section
        title="持仓明细"
        note={
          filtered.length === holdings.length
            ? `共 ${f.number(holdings.length, false)} 行`
            : `${f.number(filtered.length, false)} / ${f.number(holdings.length, false)} 行`
        }
      />
      <Filters
        values={FILTERS.filter((kind) => kind === "all" || counts[kind]).map(
          (kind) =>
            [
              kind,
              `${kind === "all" ? "全部" : ACTIVITY_LABELS[kind]} ${f.number(counts[kind], false)}`,
            ] as const,
        )}
        value={filter}
        onChange={(kind) => {
          setFilter(kind as typeof filter);
          setVisible(PAGE);
        }}
      />
      <Field
        label="按代码、公司或 CUSIP 筛选"
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setVisible(PAGE);
        }}
        autoCorrect={false}
        autoCapitalize="characters"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="排序"
        contentContainerStyle={{ gap: 8 }}
      >
        {SORTS.map(([key, label]) => {
          const active = sort.key === key;
          return (
            <Chip
              key={key}
              selected={active}
              onPress={() => {
                setSort((current) => ({
                  key,
                  dir:
                    current.key === key && current.dir === "desc"
                      ? "asc"
                      : "desc",
                }));
                setVisible(PAGE);
              }}
            >
              {`${label}${active ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}`}
            </Chip>
          );
        })}
      </ScrollView>
      <Glass style={{ paddingHorizontal: 16 }}>
        {rows.map((row, index) => (
          <View
            key={rowKey(row)}
            style={{
              gap: 8,
              paddingVertical: 12,
              borderTopWidth: index ? 1 : 0,
              borderColor: t.border,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View style={{ width: 28 }}>
                <Copy size={12} muted localize={false}>
                  {ranks.get(rowKey(row)) ?? "—"}
                </Copy>
              </View>
              <View style={{ flex: 1, alignItems: "flex-start" }}>
                <HoldingName row={row} detail />
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Copy size={14} bold localize={false}>
                  {row.value === null ? "—" : `$${f.number(row.value)}`}
                </Copy>
                <Copy size={12} muted localize={false}>
                  {f.percent(row.weight)}
                </Copy>
                <View
                  style={{
                    width: 64,
                    height: 4,
                    borderRadius: 2,
                    overflow: "hidden",
                    backgroundColor: t.tint,
                  }}
                >
                  <View
                    style={{
                      width: `${((row.weight ?? 0) / maxWeight) * 100}%`,
                      height: 4,
                      backgroundColor: t.secondary,
                    }}
                  />
                </View>
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
                paddingLeft: 36,
              }}
            >
              <ActivityBadge kind={row.activity} />
              <Copy size={12} muted>{`${f.number(row.shares)} 股`}</Copy>
              {row.previous_shares !== null &&
                row.previous_shares !== row.shares && (
                  <Copy size={12} muted>
                    {`上季 ${f.number(row.previous_shares)}`}
                  </Copy>
                )}
              {row.change !== null && row.change !== 0 && (
                <Copy
                  size={12}
                  bold
                  localize={false}
                  color={row.change > 0 ? t.accent : t.negative}
                >
                  {`${row.change > 0 ? "+" : "−"}${f.number(Math.abs(row.change))}${row.change_percent !== null ? ` (${row.change_percent > 0 ? "+" : ""}${f.percent(row.change_percent)})` : ""}`}
                </Copy>
              )}
            </View>
          </View>
        ))}
        {!rows.length && (
          <View style={{ paddingVertical: 24, gap: 12 }}>
            <Copy size={14} muted>
              没有符合筛选条件的持仓。
            </Copy>
            <Button
              onPress={() => {
                setQuery("");
                setFilter("all");
                setVisible(PAGE);
              }}
            >
              重置筛选
            </Button>
          </View>
        )}
      </Glass>
      {filtered.length > visible && (
        <Button onPress={() => setVisible((count) => count + PAGE)}>
          {`显示更多（${filtered.length - visible}）`}
        </Button>
      )}
      {data.partial && (
        <Copy size={12} muted>
          这份申报有修正，或上季申报无法读取，所以不比较季度变化。
        </Copy>
      )}
      {data.amendments.length > 0 && (
        <View style={{ gap: 4 }}>
          <Copy size={12} muted>
            修正申报
          </Copy>
          {data.amendments.map((amendment) => (
            <SecLink
              key={amendment.accession}
              href={amendment.source_url}
              label={`${amendment.form} ${f.date(amendment.filed)}`}
            />
          ))}
        </View>
      )}
    </View>
  );
}
