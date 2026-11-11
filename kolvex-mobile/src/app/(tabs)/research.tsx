import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CompanyLogo } from "../../components/CompanyLogo";
import { Filters, ResourceState } from "../../components/Content";
import {
  Button,
  Chip,
  Copy,
  Glass,
  Page,
  Skeleton,
  phone,
} from "../../components/UI";
import { profile, reports } from "../../lib/contentApi";
import type { TradingAnalysis } from "../../lib/contentTypes";
import { apiRequest } from "../../lib/http";
import { useText } from "../../lib/i18n";
import { money } from "../../lib/paperTrading";
import {
  groupResearchByStock,
  loadResearchCatalog,
  STOCKS_PER_PAGE,
} from "../../lib/researchGroups";
import type { AiTechnicalAnalysis } from "../../lib/technicalTypes";
import { useTheme } from "../../lib/theme";
import { useResource } from "../../lib/useResource";
import { useAuth } from "../../state/Auth";
import { usePreferences } from "../../state/Preferences";

type AnalysisItem = Pick<AiTechnicalAnalysis, "signals"> & {
  id: string;
  ticker: string;
  created_at: string;
  bias: AiTechnicalAnalysis["bias"] | null;
  summary: string | null;
  setup?: AiTechnicalAnalysis["setup"];
};
type ResearchMode = "all" | "technical" | "planned";
type Sort = "newest" | "ratioDesc" | "ratioAsc";
const tabs = [
  ["all", "全部"],
  ["technical", "已做技术分析"],
  ["planned", "有条件计划"],
] as const;
const sorts = [
  ["newest", "最新"],
  ["ratioDesc", "盈亏比 从高到低"],
  ["ratioAsc", "盈亏比 从低到高"],
] as const;
const gap = phone(12);
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap },
  center: { alignItems: "center", justifyContent: "center" },
});
const skeleton = Array.from({ length: 6 }, (_, index) => (
  <View key={index} style={[styles.row, { paddingVertical: phone(8) }]}>
    <Skeleton width={phone(32)} height={phone(32)} radius={999} />
    <View style={{ flex: 1, gap: phone(6) }}>
      <Skeleton width={phone(56)} height={phone(14)} />
      <Skeleton width={phone(90)} height={phone(12)} />
    </View>
    <Skeleton width={phone(56)} height={phone(16)} />
  </View>
));

export default function Research() {
  const user = useAuth().session!.user.id;
  const t = useTheme();
  const text = useText();
  const { width } = useWindowDimensions();
  const { page: pageParam } = useLocalSearchParams<{ page?: string }>();
  const numericPage = Number(pageParam);
  const requestedPage =
    Number.isSafeInteger(numericPage) && numericPage > 0 ? numericPage : 1;
  const [tab, setTab] = useState<ResearchMode>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [showSort, setShowSort] = useState(false);
  const account = useResource(`research-profile:${user}`, (signal) =>
    profile(user, signal),
  );
  const catalog = useResource(
    `research-catalog:${user}`,
    (signal) =>
      loadResearchCatalog((offset) => reports(signal, user, offset, "", 100)),
    50_000,
  );
  const index = useResource(`research-index:${user}`, (signal) =>
    apiRequest<{ technical: AnalysisItem[]; planned: AnalysisItem[] }>(
      "/market/analysis-history/_index",
      {
        signal,
        authenticated: true,
        expectedUser: user,
      },
    ),
  );
  const groups = useMemo(
    () => groupResearchByStock(catalog.data ?? []),
    [catalog.data],
  );
  const analysis = useMemo(() => {
    if (tab === "all") return [];
    const items = index.data?.[tab] ?? [];
    if (tab !== "planned" || sort === "newest") return items;
    return [...items].sort((a, b) => {
      const diff = (a.setup?.risk_reward ?? 0) - (b.setup?.risk_reward ?? 0);
      return sort === "ratioAsc" ? diff : -diff;
    });
  }, [index.data, tab, sort]);

  const current = tab === "all" ? catalog : index;
  const total = tab === "all" ? groups.length : analysis.length;
  const totalPages = Math.max(1, Math.ceil(total / STOCKS_PER_PAGE));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * STOCKS_PER_PAGE;
  const showSortButton = tab === "planned" && total > 1;
  const counts = {
    all: catalog.data && groups.length,
    technical: index.data?.technical.length,
    planned: index.data?.planned.length,
  };
  const values = tabs.map(
    ([key, label]) =>
      [
        key,
        counts[key] === undefined ? label : `${text(label)}  ${counts[key]}`,
      ] as const,
  );

  function goPage(value: number) {
    router.setParams({ page: value > 1 ? String(value) : "" });
  }

  return (
    <Page
      title="AI 研究"
      hideTitle
      scrollKey={`${tab}:${page}`}
      onRefresh={current.refresh}
      refreshing={current.loading && !!current.data}
    >
      <View
        style={{ marginHorizontal: 2, paddingTop: phone(8), gap: phone(32) }}
      >
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Copy size={28} lineHeight={35} bold>
            AI 研究
          </Copy>
          {account.data?.is_admin && (
            <Button size="sm" onPress={() => router.push("/research-tasks")}>
              管理报告
            </Button>
          )}
        </View>
        <View style={{ gap }}>
          <View style={[styles.row, { flexWrap: "wrap", gap: phone(8) }]}>
            <Copy size={17} bold>
              股票研究
            </Copy>
            {tab === "all" && total > 0 && (
              <Copy
                size={14}
                muted
              >{`${total} 只股票 · ${catalog.data?.length ?? 0} 个任务`}</Copy>
            )}
          </View>
          <Glass clear style={{ padding: 12 }}>
            <View
              style={[styles.row, { gap: phone(8), paddingBottom: phone(12) }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Filters
                  size="sm"
                  maxWidth={Math.max(
                    100,
                    width - 32 - phone(24) - (showSortButton ? phone(44) : 0),
                  )}
                  values={values}
                  value={tab}
                  onChange={(next) => {
                    if (
                      next !== "all" &&
                      next !== "technical" &&
                      next !== "planned"
                    )
                      return;
                    setTab(next);
                    goPage(1);
                  }}
                />
              </View>
              {showSortButton && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={text(
                    `排序 · ${text(sorts.find(([key]) => key === sort)?.[1] ?? "最新")}`,
                  )}
                  hitSlop={6}
                  onPress={() => setShowSort(true)}
                >
                  <Glass
                    style={[
                      styles.center,
                      {
                        borderRadius: 999,
                        width: phone(36),
                        height: phone(36),
                      },
                    ]}
                  >
                    <SymbolView
                      name={{
                        ios: "slider.horizontal.3",
                        android: "tune",
                        web: "tune",
                      }}
                      size={phone(16)}
                      tintColor={t.text}
                    />
                  </Glass>
                </Pressable>
              )}
            </View>
            {(current.loading || total > 0) && (
              <View
                style={[
                  styles.row,
                  {
                    paddingBottom: phone(8),
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderColor: t.border,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Copy size={12} muted>
                    股票
                  </Copy>
                </View>
                <Copy size={12} muted>
                  {tab === "all"
                    ? "最新结论"
                    : tab === "technical"
                      ? "方向"
                      : "盈亏比"}
                </Copy>
                <View style={{ width: phone(16) }} />
              </View>
            )}
            <ResourceState resource={current} skeleton={skeleton} />
            {!current.loading && !current.error && total === 0 && (
              <View style={{ paddingVertical: phone(24) }}>
                <Copy size={14}>
                  {tab === "all"
                    ? "暂时没有已发布的研究报告，发布后会显示在这里。"
                    : "没有符合当前分类的股票"}
                </Copy>
              </View>
            )}
            <View style={{ paddingTop: phone(4) }}>
              {tab === "all"
                ? groups
                    .slice(offset, offset + STOCKS_PER_PAGE)
                    .map((group) => (
                      <PublishedGroup
                        key={`${page}-${group.ticker}`}
                        {...group}
                        page={page}
                      />
                    ))
                : analysis
                    .slice(offset, offset + STOCKS_PER_PAGE)
                    .map((item) => (
                      <AnalysisGroup
                        key={`${tab}-${page}-${item.ticker}`}
                        item={item}
                        planned={tab === "planned"}
                      />
                    ))}
            </View>
            {totalPages > 1 && !current.error && (
              <View
                style={[
                  styles.row,
                  { justifyContent: "center", paddingVertical: phone(16) },
                ]}
              >
                <Button
                  disabled={current.loading || page === 1}
                  onPress={() => goPage(page - 1)}
                >
                  上一页
                </Button>
                <Copy size={14} muted localize={false}>
                  {page} / {totalPages}
                </Copy>
                <Button
                  disabled={current.loading || page === totalPages}
                  onPress={() => goPage(page + 1)}
                >
                  下一页
                </Button>
              </View>
            )}
          </Glass>
        </View>
      </View>
      {showSort && (
        <ResearchSort
          value={sort}
          onClose={() => setShowSort(false)}
          onChange={(next) => {
            setSort(next);
            goPage(1);
          }}
        />
      )}
    </Page>
  );
}

function ResearchSort({
  value,
  onClose,
  onChange,
}: {
  value: Sort;
  onClose: () => void;
  onChange: (value: Sort) => void;
}) {
  const t = useTheme();
  const text = useText();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text("关闭")}
          onPress={onClose}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.5)" },
          ]}
        />
        <Glass material style={{ padding: 20 }}>
          <View
            accessibilityViewIsModal
            style={{ gap: phone(16), paddingBottom: insets.bottom }}
          >
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Copy bold>排序</Copy>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text("关闭")}
                onPress={onClose}
                hitSlop={6}
                style={[
                  styles.center,
                  {
                    width: phone(36),
                    height: phone(36),
                    borderRadius: 999,
                    backgroundColor: t.brand,
                  },
                ]}
              >
                <SymbolView
                  name={{ ios: "xmark", android: "close", web: "close" }}
                  size={phone(16)}
                  tintColor={t.onBrand}
                />
              </Pressable>
            </View>
            <View style={{ gap: phone(8) }}>
              <Copy size={12} muted>
                排序
              </Copy>
              <View style={[styles.row, { gap: phone(8), flexWrap: "wrap" }]}>
                {sorts.map(([key, label]) => (
                  <Chip
                    key={key}
                    selected={key === value}
                    onPress={() => onChange(key)}
                  >
                    {label}
                  </Chip>
                ))}
              </View>
            </View>
            <View style={styles.row}>
              {value !== "newest" && (
                <Button onPress={() => onChange("newest")}>重置</Button>
              )}
              <View style={{ flex: 1 }}>
                <Button variant="primary" onPress={onClose}>
                  完成
                </Button>
              </View>
            </View>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

function ResearchRow({
  ticker,
  caption,
  trailing,
  children,
}: {
  ticker: string;
  caption: ReactNode;
  trailing: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const t = useTheme();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [
          styles.row,
          {
            minHeight: 44,
            gap: phone(16),
            paddingVertical: phone(8),
            borderRadius: phone(16),
            backgroundColor: pressed ? t.wash : undefined,
          },
        ]}
      >
        <View style={[styles.row, { flex: 1, minWidth: 0 }]}>
          <CompanyLogo symbol={ticker} size={phone(32)} />
          <View style={{ flex: 1, minWidth: 0, gap: phone(2) }}>
            <Copy size={15} lineHeight={20} bold localize={false}>
              {ticker}
            </Copy>
            {caption}
          </View>
        </View>
        {trailing}
        <SymbolView
          name={
            open
              ? {
                  ios: "chevron.up",
                  android: "expand_less",
                  web: "expand_less",
                }
              : {
                  ios: "chevron.down",
                  android: "expand_more",
                  web: "expand_more",
                }
          }
          size={phone(13)}
          tintColor={t.secondary}
        />
      </Pressable>
      {open && (
        <View
          style={{
            paddingHorizontal: phone(8),
            paddingBottom: phone(20),
            gap: phone(8),
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

function Direction({
  value,
  bias = false,
}: {
  value?: string | null;
  bias?: boolean;
}) {
  const t = useTheme();
  const positive = value?.toUpperCase() === "BUY" || value === "bullish";
  const negative = value?.toUpperCase() === "SELL" || value === "bearish";
  if (!value && bias) return null;
  return (
    <Copy
      size={14}
      bold={!!value}
      color={
        !value
          ? t.secondary
          : positive
            ? t.accent
            : negative
              ? t.negative
              : t.text
      }
    >
      {!value
        ? "暂无结论"
        : positive
          ? bias
            ? "偏多"
            : "看多"
          : negative
            ? bias
              ? "偏空"
              : "看空"
            : "中性"}
    </Copy>
  );
}

function useResearchDate() {
  const { locale } = usePreferences();
  return (value: string, calendarOnly = false) => {
    const date = new Date(calendarOnly ? `${value}T00:00:00Z` : value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: calendarOnly ? "UTC" : undefined,
        }).format(date)
      : value;
  };
}

function stockLink(ticker: string) {
  router.push({ pathname: "/stock/[symbol]", params: { symbol: ticker } });
}

function PublishedGroup({
  ticker,
  tasks,
  page,
}: {
  ticker: string;
  tasks: TradingAnalysis[];
  page: number;
}) {
  const date = useResearchDate();
  const t = useTheme();
  const text = useText();
  return (
    <ResearchRow
      ticker={ticker}
      trailing={<Direction value={tasks[0].final_decision} />}
      caption={
        <View>
          <Copy
            size={12}
            lineHeight={16}
            muted
          >{`${tasks.length} 个研究任务`}</Copy>
          <Copy size={12} lineHeight={16} muted localize={false}>
            {date(tasks[0].trade_date, true)}
          </Copy>
        </View>
      }
    >
      <View
        style={[
          styles.row,
          { justifyContent: "space-between", flexWrap: "wrap" },
        ]}
      >
        <Copy size={12} muted>
          研究任务 · 最新优先
        </Copy>
        <Copy
          size={12}
          muted
          role="link"
          onPress={() => stockLink(ticker)}
        >{`打开 ${ticker} 行情`}</Copy>
      </View>
      {tasks.map((task, index) => (
        <Pressable
          key={task.id}
          accessibilityRole="link"
          onPress={() =>
            router.push({
              pathname: "/report/[id]",
              params: {
                id: task.id,
                ...(page > 1 ? { page: String(page) } : {}),
              },
            })
          }
          style={({ pressed }) => [
            styles.row,
            {
              paddingVertical: phone(12),
              flexWrap: "wrap",
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <View style={{ flex: 1, minWidth: phone(160), gap: phone(4) }}>
            <Copy size={14} bold localize={false}>
              {date(task.trade_date, true)}
              {index === 0 ? ` · ${text("最新")}` : ""}
            </Copy>
            <Copy size={12} muted localize={false}>
              {[
                task.author?.full_name || task.author?.username || text("作者"),
                task.llm_provider,
                task.duration_seconds == null
                  ? null
                  : text(`已运行 ${Math.round(task.duration_seconds)} 秒`),
                `#${task.id.slice(0, 8)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Copy>
          </View>
          <Direction value={task.final_decision} />
          <Copy size={12} color={t.secondary}>
            阅读报告
          </Copy>
        </Pressable>
      ))}
    </ResearchRow>
  );
}

function AnalysisGroup({
  item,
  planned,
}: {
  item: AnalysisItem;
  planned: boolean;
}) {
  const date = useResearchDate()(item.created_at);
  const setup = planned ? item.setup : null;
  return (
    <ResearchRow
      ticker={item.ticker}
      caption={
        <Copy size={12} muted lines={1} localize={false}>
          {setup?.name ?? date}
        </Copy>
      }
      trailing={
        <View style={{ alignItems: "flex-end", gap: phone(2) }}>
          {!!setup && (
            <Copy size={15} bold localize={false}>
              {setup.risk_reward.toFixed(2)} : 1
            </Copy>
          )}
          <Direction value={item.bias} bias />
        </View>
      }
    >
      {setup ? (
        <>
          <View
            style={[styles.row, { flexWrap: "wrap", alignItems: "flex-start" }]}
          >
            {(
              [
                [
                  "入场区间",
                  `${money(setup.entry_low)} – ${money(setup.entry_high)}`,
                ],
                ["止损", money(setup.invalidation)],
                ["目标", setup.targets.map(money).join(" / ")],
                ["日期", date],
              ] as const
            ).map(([label, value]) => (
              <View
                key={label}
                style={{ flexBasis: "46%", flexGrow: 1, gap: phone(4) }}
              >
                <Copy size={12} muted>
                  {label}
                </Copy>
                <Copy size={14} bold localize={false}>
                  {value}
                </Copy>
              </View>
            ))}
          </View>
          <Copy size={12} muted>
            计划依据与触发条件
          </Copy>
          <Copy size={14} lineHeight={28} localize={false}>
            {setup.reason}
          </Copy>
          <Button
            size="sm"
            onPress={() =>
              router.push({
                pathname: "/paper-trading",
                params: {
                  symbol: item.ticker,
                  side: setup.direction === "bullish" ? "long" : "short",
                  entry: String(setup.entry_low),
                  stop: String(setup.invalidation),
                  target: String(setup.targets[0] ?? ""),
                  note: [setup.name, setup.reason].join("\n").slice(0, 2000),
                  source: "ai_setup",
                },
              })
            }
          >
            用此计划模拟交易
          </Button>
        </>
      ) : (
        <>
          {!!item.summary && (
            <Copy size={14} lineHeight={28} localize={false}>
              {item.summary}
            </Copy>
          )}
          {item.signals.length > 0 && (
            <View style={{ gap: phone(6), paddingTop: phone(8) }}>
              <Copy size={12} muted>
                信号
              </Copy>
              {item.signals.map((signal, index) => (
                <Copy key={index} size={14} lineHeight={24} localize={false}>
                  • {signal}
                </Copy>
              ))}
            </View>
          )}
        </>
      )}
      <View style={{ paddingVertical: phone(8) }}>
        <Copy
          size={14}
          muted
          role="link"
          onPress={() => stockLink(item.ticker)}
        >{`打开 ${item.ticker} 行情`}</Copy>
      </View>
    </ResearchRow>
  );
}
