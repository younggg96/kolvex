import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  bidAskSpread,
  inTheMoney,
  nearStrikes,
  strikeRows,
  type OptionContract,
  type OptionsChain,
} from "../lib/optionsChain";
import { optionsChain } from "../lib/stockExtrasApi";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { usePreferences } from "../state/Preferences";
import { AuthGate, Filters } from "./Content";
import { Sheet } from "./PaperTrading";
import { CardsSkeleton, ChipsSkeleton } from "./Skeletons";
import {
  Button,
  Copy,
  Empty,
  Failure,
  Glass,
  LoadingStatus,
  Section,
} from "./UI";

const NEAR = 12;
const skeleton = (
  <>
    <ChipsSkeleton count={4} />
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
    <CardsSkeleton count={1} lines={[{ size: 14, lines: 8, width: "80%" }]} />
  </>
);
function useFormat() {
  const intl = usePreferences().locale === "en" ? "en-US" : "zh-CN";
  const missing = (
    value: number | null | undefined,
  ): value is null | undefined =>
    value === null || value === undefined || !Number.isFinite(value);
  const fixed = (digits: number) => (value: number | null | undefined) =>
    missing(value)
      ? "—"
      : new Intl.NumberFormat(intl, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(value);
  const money = fixed(2);
  return {
    money,
    greek: fixed(4),
    price: (value: number | null | undefined) =>
      missing(value) ? "—" : `$${money(value)}`,
    int: (value: number | null | undefined) =>
      missing(value) ? "—" : new Intl.NumberFormat(intl).format(value),
    percent: (value: number | null | undefined, signed = false) =>
      missing(value)
        ? "—"
        : `${signed && value > 0 ? "+" : ""}${(value * 100).toFixed(2)}%`,
    date: (value: string) =>
      Number.isFinite(Date.parse(value))
        ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString(intl, {
            timeZone: "UTC",
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
    time: (value: string | null | undefined) =>
      value && Number.isFinite(Date.parse(value))
        ? new Date(value).toLocaleString(intl)
        : "—",
  };
}
const ERRORS: Record<string, string> = {
  not_configured:
    "期权数据源尚未配置。需要在后端设置 Alpaca API Key 后才能显示。",
  no_options: "这只股票没有上市期权。",
  rate_limited: "期权数据源请求过于频繁，请稍后再试。",
  unauthorized: "登录后可查看期权数据。",
  unavailable: "期权数据加载失败，请重试。",
};

export function StockOptionsChain({ symbol }: { symbol: string }) {
  return (
    <AuthGate title="期权链" inline skeleton={skeleton}>
      <Chain symbol={symbol} />
    </AuthGate>
  );
}
function Chain({ symbol }: { symbol: string }) {
  const user = useAuth().session!.user.id;
  const f = useFormat();
  const [expiration, setExpiration] = useState<string | null>(null);
  const [layout, setLayout] = useState("both");
  const [range, setRange] = useState("near");
  const [selected, setSelected] = useState<OptionContract | null>(null);
  const resource = useResource(
    `options-chain:${user}:${symbol}:${expiration}`,
    (signal) => optionsChain(symbol, expiration, user, signal),
    50_000,
  );
  // The expiration list stays up while the next expiration loads.
  const [last, setLast] = useState<OptionsChain | null>(null);
  if (resource.data && resource.data !== last) setLast(resource.data);
  const chain = resource.data ?? last;
  if (!chain)
    return resource.loading ? (
      <LoadingStatus label="正在加载期权…">{skeleton}</LoadingStatus>
    ) : resource.error === "no_options" ? (
      <Empty title="暂无期权" message={ERRORS.no_options} />
    ) : (
      <Failure
        message={ERRORS[resource.error ?? ""] ?? ERRORS.unavailable}
        retry={
          resource.error === "not_configured" ? undefined : resource.refresh
        }
      />
    );
  const spot = chain.underlying_price;
  const allRows = strikeRows(chain.contracts);
  const rows = range === "near" ? nearStrikes(allRows, spot, NEAR) : allRows;
  const m = chain.metrics;
  const move = m.expected_move;
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Copy size={14}>{`标的价 ${f.price(spot)}`}</Copy>
        <Copy size={12} muted>
          {`数据时间 ${f.time(chain.as_of)}`}
        </Copy>
        {chain.source.delayed && (
          <Copy size={12} muted>{`延迟 (${chain.source.feed})`}</Copy>
        )}
      </View>
      <Filters
        size="sm"
        values={chain.expirations.map((date) => [date, f.date(date)] as const)}
        value={expiration ?? chain.expiration}
        onChange={setExpiration}
        disabled={resource.loading}
      />
      {!!resource.error && (
        <Failure
          message={ERRORS[resource.error] ?? ERRORS.unavailable}
          retry={resource.refresh}
        />
      )}
      <Glass style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16 }}>
          {(
            [
              ["距到期", `${m.days_to_expiration} 天`],
              ["平值隐含波动率", f.percent(m.atm_iv)],
              [
                "预期波动",
                move ? `±${f.price(move.value)} (${f.percent(move.pct)})` : "—",
              ],
              [
                "最大痛点",
                m.max_pain
                  ? `${f.price(m.max_pain.strike)} (${f.percent(m.max_pain_vs_spot_pct, true)})`
                  : "—",
              ],
              ["看跌/看涨 · 成交量", f.money(m.volume_put_call_ratio)],
              ["看跌/看涨 · 持仓量", f.money(m.oi_put_call_ratio)],
              [
                "成交量 · 看涨 / 看跌",
                `${f.int(m.call_volume)} / ${f.int(m.put_volume)}`,
              ],
              [
                "持仓量 · 看涨 / 看跌",
                `${f.int(m.call_oi)} / ${f.int(m.put_oi)}`,
              ],
            ] as [string, string][]
          ).map(([label, value]) => (
            <View key={label} style={{ width: "50%", paddingRight: 8, gap: 4 }}>
              <Copy size={12} muted>
                {label}
              </Copy>
              <Copy size={15} bold>
                {value}
              </Copy>
            </View>
          ))}
        </View>
      </Glass>
      <Filters
        size="sm"
        values={[
          ["both", "看涨 + 看跌"],
          ["call", "看涨"],
          ["put", "看跌"],
        ]}
        value={layout}
        onChange={setLayout}
      />
      <Filters
        size="sm"
        values={[
          ["near", `近价 ${NEAR * 2} 档`],
          ["all", `全部 ${allRows.length} 档`],
        ]}
        value={range}
        onChange={setRange}
      />
      {!rows.length && <Empty title="暂无合约" message="该到期日没有合约。" />}
      {!!rows.length && (
        <Glass style={{ paddingHorizontal: 12 }}>
          <View style={{ flexDirection: "row", paddingVertical: 10 }}>
            {layout !== "put" && (
              <View style={{ flex: 1 }}>
                <Copy size={12} bold muted>
                  看涨 Call
                </Copy>
              </View>
            )}
            <View style={{ width: 72, alignItems: "center" }}>
              <Copy size={12} bold muted>
                行权价
              </Copy>
            </View>
            {layout !== "call" && (
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Copy size={12} bold muted>
                  看跌 Put
                </Copy>
              </View>
            )}
          </View>
          {rows.map((row) => (
            <View
              key={row.strike}
              style={{ flexDirection: "row", alignItems: "stretch" }}
            >
              {layout !== "put" && (
                <ContractCell
                  contract={row.call}
                  itm={inTheMoney("call", row.strike, spot)}
                  onPress={setSelected}
                />
              )}
              <StrikeCell strike={f.money(row.strike)} />
              {layout !== "call" && (
                <ContractCell
                  contract={row.put}
                  itm={inTheMoney("put", row.strike, spot)}
                  onPress={setSelected}
                  end
                />
              )}
            </View>
          ))}
        </Glass>
      )}
      <Copy size={12} muted>
        深色单元格为价内。来源：Alpaca 期权行情（参考报价，延迟，非完整 OPRA
        行情）。持仓量与合约收盘价每日更新一次；希腊值与隐含波动率来自数据源；最大痛点、预期波动与看跌/看涨比仅按当前到期日计算。仅供研究，不提供下单。
      </Copy>
      <ContractSheet
        contract={selected}
        spot={spot}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}
function StrikeCell({ strike }: { strike: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 72,
        alignItems: "center",
        justifyContent: "center",
        borderTopWidth: 1,
        borderColor: t.border,
      }}
    >
      <Copy size={14} bold localize={false}>
        {strike}
      </Copy>
    </View>
  );
}
function ContractCell({
  contract,
  itm,
  onPress,
  end = false,
}: {
  contract?: OptionContract;
  itm: boolean;
  onPress: (contract: OptionContract) => void;
  end?: boolean;
}) {
  const t = useTheme();
  const text = useText();
  const f = useFormat();
  const box = {
    flex: 1,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: end ? "flex-end" : "flex-start",
    borderTopWidth: 1,
    borderColor: t.border,
    backgroundColor: itm ? t.tint : undefined,
  } as const;
  if (!contract)
    return (
      <View style={box}>
        <Copy size={13} muted localize={false}>
          —
        </Copy>
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text("查看合约详情")} ${f.money(contract.strike)} ${text(contract.type === "call" ? "看涨" : "看跌")}`}
      onPress={() => onPress(contract)}
      style={({ pressed }) => [box, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Copy size={14} bold localize={false}>
        {f.money(contract.bid)} × {f.money(contract.ask)}
      </Copy>
      <Copy size={11} muted>
        {`量 ${f.int(contract.volume)} · 仓 ${f.int(contract.open_interest)}`}
      </Copy>
      <Copy size={11} muted localize={false}>
        IV {f.percent(contract.iv)} · Δ {f.greek(contract.delta)}
      </Copy>
    </Pressable>
  );
}
function ContractSheet({
  contract: x,
  spot,
  onClose,
}: {
  contract: OptionContract | null;
  spot: number | null;
  onClose: () => void;
}) {
  const f = useFormat();
  const at = (price: string, size: number | null, exchange: string | null) =>
    `${price}${size === null ? "" : ` × ${f.int(size)}`}${exchange ? ` · ${exchange}` : ""}`;
  const groups: [string, [string, string][]][] = x
    ? [
        [
          "报价",
          [
            ["买价", at(f.money(x.bid), x.bid_size, x.bid_exchange)],
            ["卖价", at(f.money(x.ask), x.ask_size, x.ask_exchange)],
            ["中间价", f.money(x.mid)],
            ["价差", f.money(bidAskSpread(x))],
            ["报价时间", f.time(x.quote_time)],
          ],
        ],
        [
          "最新成交",
          [
            ["价格", at(f.money(x.last), x.last_size, x.last_exchange)],
            ["涨跌", `${f.money(x.change)} (${f.percent(x.change_pct, true)})`],
            ["成交时间", f.time(x.trade_time)],
          ],
        ],
        [
          "当日",
          [
            ["开盘", f.money(x.open)],
            ["最高", f.money(x.high)],
            ["最低", f.money(x.low)],
            ["收盘", f.money(x.close)],
            ["VWAP", f.money(x.vwap)],
            ["成交量", f.int(x.volume)],
            ["成交笔数", f.int(x.trade_count)],
          ],
        ],
        [
          "上一交易日",
          [
            ["收盘", f.money(x.prev_close)],
            ["成交量", f.int(x.prev_volume)],
            ["合约收盘价", f.money(x.close_price)],
          ],
        ],
        [
          "波动率与希腊值",
          [
            ["隐含波动率", f.percent(x.iv)],
            ["Delta", f.greek(x.delta)],
            ["Gamma", f.greek(x.gamma)],
            ["Theta", f.greek(x.theta)],
            ["Vega", f.greek(x.vega)],
            ["Rho", f.greek(x.rho)],
          ],
        ],
        [
          "合约",
          [
            ["持仓量", f.int(x.open_interest)],
            [
              "价内/价外",
              spot === null
                ? "—"
                : inTheMoney(x.type, x.strike, spot)
                  ? "价内"
                  : "价外",
            ],
            [
              "行权方式",
              x.style === "american"
                ? "美式"
                : x.style === "european"
                  ? "欧式"
                  : (x.style ?? "—"),
            ],
            ["合约乘数", f.int(x.multiplier)],
            ["到期日", f.date(x.expiration)],
            ["合约代码", x.symbol],
          ],
        ],
      ]
    : [];
  return (
    <Sheet
      title={x?.type === "put" ? "看跌 Put" : "看涨 Call"}
      visible={!!x}
      onClose={onClose}
    >
      {x && (
        <Copy size={24} bold localize={false}>
          {x.root ?? ""} ${f.money(x.strike)}
        </Copy>
      )}
      {groups.map(([title, items]) => (
        <View key={title} style={{ gap: 8 }}>
          <Section title={title} />
          <Glass style={{ padding: 16 }}>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}
            >
              {items.map(([label, value]) => (
                <View
                  key={label}
                  style={{ width: "50%", paddingRight: 8, gap: 2 }}
                >
                  <Copy size={12} muted>
                    {label}
                  </Copy>
                  <Copy size={14}>{value}</Copy>
                </View>
              ))}
            </View>
          </Glass>
        </View>
      ))}
      <Button size="sm" onPress={onClose}>
        完成
      </Button>
    </Sheet>
  );
}
