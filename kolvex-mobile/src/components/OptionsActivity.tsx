import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  barShare,
  formatPremium,
  type ActivityCandidate,
  type ActivityCandidates,
  type ActivityContract,
  type ActivityRun,
  type ActivitySession,
  type Contributor,
} from "../lib/optionsActivity";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { usePreferences } from "../state/Preferences";
import { Filters } from "./Content";
import { Copy, Glass, styles } from "./UI";

export const SESSION_LABELS: Record<ActivitySession, string> = {
  pre: "盘前",
  intraday: "盘中",
  post: "盘后",
};
const fixed = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);
const pct = (value: number | null | undefined, signed = false) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${signed && value > 0 ? "+" : ""}${value.toFixed(2)}%`;
const openOptions = (symbol: string) =>
  router.push(`/stock/${encodeURIComponent(symbol)}?tab=options`);
function useTone() {
  const t = useTheme();
  return (value: number | null | undefined) =>
    !value ? undefined : value > 0 ? t.accent : t.negative;
}
function useIntl() {
  return usePreferences().locale === "en" ? "en-US" : "zh-CN";
}
/** Section title with its explanation behind an info button, closed by default. */
function Header({ title, note }: { title: string; note?: string }) {
  const text = useText();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <View style={{ flexShrink: 1 }}>
          <Copy size={18} bold>
            {title}
          </Copy>
        </View>
        {!!note && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${text("说明")}：${text(title)}`}
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((value) => !value)}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Copy muted localize={false}>
              ⓘ
            </Copy>
          </Pressable>
        )}
      </View>
      {open && !!note && (
        <Copy size={12} muted>
          {note}
        </Copy>
      )}
    </View>
  );
}
function Tag({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        backgroundColor: t.tint,
      }}
    >
      <Copy size={11} muted>
        {label}
      </Copy>
    </View>
  );
}
function SymbolLink({ symbol, size = 15 }: { symbol: string; size?: number }) {
  const text = useText();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${text("查看期权链")} ${symbol}`}
      hitSlop={10}
      onPress={() => openOptions(symbol)}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Copy size={size} bold localize={false}>
        {symbol}
      </Copy>
    </Pressable>
  );
}

export function SummaryCard({ run }: { run: ActivityRun }) {
  const t = useTheme();
  const { locale } = usePreferences();
  const intl = useIntl();
  const summary = run.summary;
  const points = summary
    ? locale === "en"
      ? summary.points_en
      : summary.points_zh
    : [];
  const sentiment = summary?.sentiment;
  const ranAt = `${new Date(run.run_at).toLocaleString(intl, {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} ET`;
  return (
    <Glass style={{ padding: 20, gap: 12 }}>
      <View style={styles.row}>
        <Copy size={18} bold>
          重点摘要
        </Copy>
        {sentiment && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: t.tint,
            }}
          >
            <Copy
              size={12}
              bold
              color={
                sentiment === "bullish"
                  ? t.accent
                  : sentiment === "bearish"
                    ? t.negative
                    : t.secondary
              }
            >
              {{ bullish: "偏多", bearish: "偏空", mixed: "分歧" }[sentiment]}
            </Copy>
          </View>
        )}
      </View>
      {points.map((point, index) => (
        <View key={index} style={{ flexDirection: "row", gap: 8 }}>
          <Copy size={15} muted localize={false}>
            {index + 1}.
          </Copy>
          <View style={{ flex: 1 }}>
            <Copy size={15} selectable>
              {point}
            </Copy>
          </View>
        </View>
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 6 }}>
        <Copy size={12} muted>
          {SESSION_LABELS[run.session]}
        </Copy>
        <Copy size={12} muted localize={false}>
          · {ranAt}
        </Copy>
        {!!run.data_date && run.data_date !== run.trade_date && (
          <Copy size={12} muted>{`· 成交数据来自 ${run.data_date}`}</Copy>
        )}
        <Copy size={12} muted>{`· ${run.universe_size} 个标的`}</Copy>
        {run.failed_symbols.length > 0 && (
          <Copy size={12} muted>
            {`· 未取到: ${run.failed_symbols.join(", ")}`}
          </Copy>
        )}
        {summary?.source === "template" && (
          <Copy size={12} muted>
            · 未使用 AI，按模板生成
          </Copy>
        )}
      </View>
    </Glass>
  );
}

export function MarketOverview({ run }: { run: ActivityRun }) {
  const t = useTheme();
  const tone = useTone();
  const m = run.payload.market;
  const vsBaseline =
    m.pc_premium_ratio !== null && m.pc_baseline
      ? m.pc_premium_ratio / m.pc_baseline - 1
      : null;
  const series = run.day_runs
    .filter((r) => r.market)
    .map((r) => ({
      session: r.session,
      call: r.market!.call_premium,
      put: r.market!.put_premium,
    }));
  const max = Math.max(0, ...series.flatMap((s) => [s.call, s.put]));
  const figures: [string, string, string | undefined][] = [
    ["净权利金", formatPremium(m.net_premium, true), tone(m.net_premium)],
    ["Call 成交额", formatPremium(m.call_premium), undefined],
    ["Put 成交额", formatPremium(m.put_premium), undefined],
    ["Put/Call 成交额比", fixed(m.pc_premium_ratio), undefined],
  ];
  const pill = {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: t.tint,
  } as const;
  return (
    <View style={{ gap: 12 }}>
      <Header
        title="市场概览"
        note={`${m.tickers_scanned} 个标的，现价 ±15%、45 天内到期的合约`}
      />
      <Glass style={{ padding: 16, gap: 16 }}>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            rowGap: 24,
            borderBottomWidth: 1,
            borderColor: t.border,
            paddingBottom: 24,
          }}
        >
          {figures.map(([label, value, color]) => (
            <View
              key={label}
              style={{ width: "50%", paddingRight: 24, gap: 4 }}
            >
              <Copy size={12} muted>
                {label}
              </Copy>
              <Copy size={18} bold color={color} localize={false}>
                {value}
              </Copy>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {vsBaseline !== null && (
            <View style={[pill, { flexWrap: "wrap" }]}>
              <Copy size={12}>P/C 较基线</Copy>
              <Copy
                size={12}
                localize={false}
                color={vsBaseline > 0 ? t.negative : t.accent}
              >
                {pct(vsBaseline * 100, true)}
              </Copy>
              <Copy size={12} muted>
                {`（前 ${m.baseline_runs} 次同时段中位数 ${fixed(m.pc_baseline)}）`}
              </Copy>
            </View>
          )}
          <View style={pill}>
            <Copy size={12} localize={false}>
              ETF
            </Copy>
            <Copy size={12} localize={false} color={tone(m.etf_net_premium)}>
              {formatPremium(m.etf_net_premium, true)}
            </Copy>
          </View>
          <View style={pill}>
            <Copy size={12}>个股</Copy>
            <Copy size={12} localize={false} color={tone(m.stock_net_premium)}>
              {formatPremium(m.stock_net_premium, true)}
            </Copy>
          </View>
        </View>
        {series.length > 1 && (
          <View style={{ gap: 12 }}>
            <Copy size={12} muted>
              今日各时点 Call 与 Put 成交额
            </Copy>
            {series.map((item) => (
              <View key={item.session} style={{ gap: 4 }}>
                <Copy size={12} bold>
                  {SESSION_LABELS[item.session]}
                </Copy>
                {(
                  [
                    ["Call", item.call, t.chartUp],
                    ["Put", item.put, t.chartDown],
                  ] as const
                ).map(([name, value, color]) => (
                  <View
                    key={name}
                    accessible
                    accessibilityLabel={`${name} ${formatPremium(value)}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View style={{ width: 32 }}>
                      <Copy size={12} muted localize={false}>
                        {name}
                      </Copy>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        height: 10,
                        borderRadius: 5,
                        overflow: "hidden",
                        backgroundColor: t.tint,
                      }}
                    >
                      <View
                        style={{
                          width: `${barShare(value, max) * 100}%`,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: color,
                        }}
                      />
                    </View>
                    <View style={{ width: 64, alignItems: "flex-end" }}>
                      <Copy size={12} localize={false}>
                        {formatPremium(value)}
                      </Copy>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </Glass>
    </View>
  );
}

function ContributorRow({ item, max }: { item: Contributor; max: number }) {
  const t = useTheme();
  const tone = useTone();
  const share = barShare(item.net_premium, max) * 50;
  const positive = item.net_premium > 0;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 44,
      }}
    >
      <View style={{ width: 72 }}>
        <SymbolLink symbol={item.symbol} size={16} />
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          flex: 1,
          height: 10,
          borderRadius: 5,
          backgroundColor: t.tint,
        }}
      >
        <View
          style={{
            position: "absolute",
            left: "50%",
            width: 1,
            height: 10,
            backgroundColor: t.border,
          }}
        />
        <View
          style={{
            position: "absolute",
            height: 10,
            borderRadius: 5,
            width: `${share}%`,
            backgroundColor: positive ? t.chartUp : t.chartDown,
            ...(positive ? { left: "50%" } : { right: "50%" }),
          }}
        />
      </View>
      <View style={{ width: 88, alignItems: "flex-end" }}>
        <Copy size={14} bold localize={false} color={tone(item.net_premium)}>
          {formatPremium(item.net_premium, true)}
        </Copy>
      </View>
    </View>
  );
}
export function ContributionBoard({ run }: { run: ActivityRun }) {
  const t = useTheme();
  const { positive, negative, positive_total, negative_total } =
    run.payload.contributors;
  const max = Math.max(
    0,
    ...positive.map((item) => Math.abs(item.net_premium)),
    ...negative.map((item) => Math.abs(item.net_premium)),
  );
  if (!positive.length && !negative.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <Header
        title="净权利金贡献榜"
        note="每个标的的 Call 成交额 − Put 成交额"
      />
      <Glass style={{ padding: 16 }}>
        <View style={[styles.row, { paddingBottom: 8 }]}>
          <Copy size={12} color={t.negative}>
            {`负贡献 ${formatPremium(negative_total, true)}`}
          </Copy>
          <Copy size={12} color={t.accent}>
            {`正贡献 ${formatPremium(positive_total, true)}`}
          </Copy>
        </View>
        {positive.map((item) => (
          <ContributorRow key={item.symbol} item={item} max={max} />
        ))}
        {positive.length > 0 && negative.length > 0 && (
          <View
            style={{ height: 1, marginVertical: 8, backgroundColor: t.border }}
          />
        )}
        {[...negative].reverse().map((item) => (
          <ContributorRow key={item.symbol} item={item} max={max} />
        ))}
      </Glass>
    </View>
  );
}

function useExpiryLabel() {
  const intl = useIntl();
  return (iso: string) =>
    new Intl.DateTimeFormat(intl, {
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
}
function Details({ items }: { items: [string, string][] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
      {items.map(([label, value]) => (
        <View key={label} style={{ width: "50%", paddingRight: 8, gap: 2 }}>
          <Copy size={12} muted>
            {label}
          </Copy>
          <Copy size={14} localize={false} selectable>
            {value}
          </Copy>
        </View>
      ))}
    </View>
  );
}
function ContractRow({
  item,
  first,
}: {
  item: ActivityContract;
  first: boolean;
}) {
  const t = useTheme();
  const text = useText();
  const intl = useIntl();
  const expiry = useExpiryLabel();
  const [open, setOpen] = useState(false);
  const call = item.type === "call";
  const count = (value: number) => new Intl.NumberFormat(intl).format(value);
  const heavyVolume = item.vol_oi !== null && item.vol_oi >= 3;
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderColor: t.border }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 10,
        }}
      >
        <View style={{ width: 60 }}>
          <SymbolLink symbol={item.underlying} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View
            style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}
          >
            <Copy size={15} bold localize={false}>
              ${item.strike}
            </Copy>
            <Copy
              size={15}
              bold
              localize={false}
              color={call ? t.accent : t.negative}
            >
              {call ? "C" : "P"}
            </Copy>
            <Copy size={12} muted>
              {`${expiry(item.expiration)} · ${item.dte} 天`}
            </Copy>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Copy size={12} muted={!heavyVolume} bold={heavyVolume}>
              {`量/持仓 ${item.vol_oi === null ? "—" : fixed(item.vol_oi, 1)}×`}
            </Copy>
            {item.flags.new_positions && <Tag label="新开仓" />}
            {item.flags.crosses_earnings && <Tag label="跨财报" />}
          </View>
        </View>
        <Copy size={15} bold localize={false}>
          {formatPremium(item.premium)}
        </Copy>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${text(open ? "收起" : "展开")} ${item.underlying} $${item.strike} ${text(call ? "看涨" : "看跌")} ${text("详情")}`}
          onPress={() => setOpen((value) => !value)}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Copy muted localize={false}>
            {open ? "⌃" : "⌄"}
          </Copy>
        </Pressable>
      </View>
      {open && (
        <View style={{ gap: 12, paddingBottom: 16 }}>
          <Details
            items={[
              ["成交量", count(item.volume)],
              ["持仓量", count(item.open_interest)],
              ["均价", `$${fixed(item.price)}`],
              ["IV", item.iv === null ? "—" : pct(item.iv * 100)],
              ["Delta", fixed(item.delta, 3)],
              ["价外幅度", pct(item.otm_pct)],
              ["最近成交", item.last === null ? "—" : `$${fixed(item.last)}`],
              ["到期日", item.expiration],
              ["合约", item.symbol],
            ]}
          />
          <Copy
            size={14}
            bold
            color={t.accent}
            role="link"
            onPress={() => openOptions(item.underlying)}
          >
            {`查看 ${item.underlying} 期权链 →`}
          </Copy>
        </View>
      )}
    </View>
  );
}
export type ContractFilter = "all" | "etf" | "stock";
export function UnusualContracts({
  run,
  initial = "all",
}: {
  run: ActivityRun;
  initial?: ContractFilter;
}) {
  const [filter, setFilter] = useState<string>(initial);
  const all = run.payload.contracts;
  const etf = all.filter((item) => item.is_etf).length;
  const shown = all.filter(
    (item) => filter === "all" || (filter === "etf") === item.is_etf,
  );
  return (
    <View style={{ gap: 12 }}>
      <Header
        title="异动合约"
        note="按成交权利金从大到小排序。量/持仓 超过 3 倍加粗：当日成交量超过原有持仓量。"
      />
      <Filters
        size="sm"
        values={[
          ["all", `全部 ${all.length}`],
          ["etf", `ETF指数 ${etf}`],
          ["stock", `个股 ${all.length - etf}`],
        ]}
        value={filter}
        onChange={setFilter}
      />
      <Glass style={{ paddingHorizontal: 16 }}>
        {shown.length === 0 ? (
          <View style={{ paddingVertical: 24 }}>
            <Copy size={14} muted>
              这个分类本次没有合约。
            </Copy>
          </View>
        ) : (
          shown.map((item, index) => (
            <ContractRow key={item.symbol} item={item} first={!index} />
          ))
        )}
      </Glass>
    </View>
  );
}

function CandidateCard({ item }: { item: ActivityCandidate }) {
  const t = useTheme();
  const { locale } = usePreferences();
  const expiry = useExpiryLabel();
  const zh = locale !== "en";
  const call = item.type === "call";
  const reasons: [string, string][] = [
    ["方向理由", zh ? item.thesis_zh : item.thesis_en],
    ["关键风险", zh ? item.risk_zh : item.risk_en],
    ["失效条件", zh ? item.invalidation_zh : item.invalidation_en],
  ];
  return (
    <Glass style={{ padding: 16, gap: 8 }}>
      <View style={styles.row}>
        <SymbolLink symbol={item.underlying} />
        <Tag
          label={
            { low: "低置信度", medium: "中置信度", high: "高置信度" }[
              item.confidence
            ]
          }
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <Copy size={18} bold localize={false}>
          ${item.strike}
        </Copy>
        <Copy size={14} bold color={call ? t.accent : t.negative}>
          {call ? "Call · 看涨" : "Put · 看跌"}
        </Copy>
        <Copy size={12} muted>
          {`${expiry(item.expiration)} · ${item.dte} 天`}
        </Copy>
        {item.flags.crosses_earnings && <Tag label="跨财报" />}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12 }}>
        <Copy size={12} muted>{`成交额 ${formatPremium(item.premium)}`}</Copy>
        {item.vol_oi !== null && (
          <Copy size={12} muted>{`量/持仓 ${fixed(item.vol_oi, 1)}×`}</Copy>
        )}
        {item.price !== null && (
          <Copy size={12} muted>{`均价 $${fixed(item.price)}`}</Copy>
        )}
      </View>
      <View
        style={{
          gap: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderColor: t.border,
        }}
      >
        {reasons.map(([label, body]) => (
          <View key={label} style={{ gap: 4 }}>
            <Copy size={12} muted>
              {label}
            </Copy>
            <Copy size={14} selectable>
              {body}
            </Copy>
          </View>
        ))}
      </View>
    </Glass>
  );
}
export function ResearchCandidates({
  candidates,
}: {
  candidates?: ActivityCandidates | null;
}) {
  if (!candidates) return null;
  return (
    <View style={{ gap: 12 }}>
      <Header
        title="AI 研究候选"
        note="由 AI 从本轮实际成交的合约中挑选，到期日至少在 7 天后。所有用户看到的内容相同，不基于你的持仓，是值得进一步研究的合约，而不是下单指令。延迟数据没有主动买卖方向，成交额不代表买入信号，大额 Put 常常是对冲。"
      />
      {candidates.status === "ok" && candidates.items.length > 0 ? (
        candidates.items.map((item) => (
          <CandidateCard key={item.symbol} item={item} />
        ))
      ) : (
        <Glass style={{ padding: 16 }}>
          <Copy size={14} muted>
            本轮 AI 研究候选暂不可用。
          </Copy>
        </Glass>
      )}
    </View>
  );
}

export function TickerLevels({ run }: { run: ActivityRun }) {
  const tone = useTone();
  const tickers = run.payload.tickers.filter(
    (item) => item.call_premium + item.put_premium > 0,
  );
  if (!tickers.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <Header
        title="隐含区间与关键价位"
        note="期权隐含区间不是走势预测。Gamma 价位是做市商 Gamma 暴露最大的行权价；Max Pain 取持仓量最大的到期日。"
      />
      {tickers.map((item) => (
        <Glass key={item.symbol} style={{ padding: 16, gap: 12 }}>
          <View style={styles.row}>
            <SymbolLink symbol={item.symbol} size={16} />
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Copy size={14} localize={false}>
                ${fixed(item.spot)}
              </Copy>
              <Copy size={14} localize={false} color={tone(item.change_pct)}>
                {pct(item.change_pct, true)}
              </Copy>
            </View>
          </View>
          <Details
            items={[
              ["净权利金", formatPremium(item.net_premium, true)],
              [
                "P/C（基线）",
                `${fixed(item.pc_premium_ratio)} (${fixed(item.pc_baseline)})`,
              ],
              [
                "隐含区间",
                item.implied_range
                  ? `$${fixed(item.implied_range.low)}–$${fixed(item.implied_range.high)} · ±${fixed(item.implied_range.pct)}% · ${item.implied_range.expiration.slice(5)}`
                  : "—",
              ],
              ["Max Pain", item.max_pain ? `$${item.max_pain.strike}` : "—"],
              [
                "Gamma 价位",
                item.gamma_level ? `$${item.gamma_level.strike}` : "—",
              ],
              ["财报", item.earnings_date ?? "—"],
            ]}
          />
        </Glass>
      ))}
    </View>
  );
}
