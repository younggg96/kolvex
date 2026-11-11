import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AuthGate, Filters } from "../../../components/Content";
import { PaperReviews } from "../../../components/PaperReviews";
import {
  EquityChart,
  ExitsSheet,
  FillCard,
  OrderCard,
  OrderTicketSheet,
  PositionCard,
  usePaperAccount,
  usePnlColor,
  type TicketDraft,
} from "../../../components/PaperTrading";
import { CardsSkeleton } from "../../../components/Skeletons";
import {
  Button,
  Copy,
  Empty,
  Failure,
  Glass,
  LoadingStatus,
  Page,
  Section,
} from "../../../components/UI";
import {
  money,
  PAPER_SYMBOL,
  signedMoney,
  type Position,
} from "../../../lib/paperTrading";

const skeleton = (
  <>
    <CardsSkeleton
      count={2}
      padding={16}
      gap={8}
      lines={[
        { size: 12, width: "40%" },
        { size: 20, width: "50%" },
        { size: 12, width: "60%" },
      ]}
    />
    <CardsSkeleton
      count={1}
      lines={[{ size: 16, width: "40%" }]}
      chartHeight={180}
    />
  </>
);
const positive = (value: unknown) => {
  const parsed = Number(value);
  return parsed > 0 && Number.isFinite(parsed) ? String(parsed) : undefined;
};

export default function PaperTrading() {
  return (
    <AuthGate title="虚拟交易" skeleton={skeleton}>
      <Workspace />
    </AuthGate>
  );
}
function Workspace() {
  const params = useLocalSearchParams<Record<string, string>>();
  const state = usePaperAccount();
  const { account, busy } = state;
  const pnlColor = usePnlColor();
  // A link from an AI setup carries an editable plan, never an order.
  const symbol =
    typeof params.symbol === "string" ? params.symbol.toUpperCase() : "";
  const linked: TicketDraft | undefined = PAPER_SYMBOL.test(symbol)
    ? {
        symbol,
        side: params.side === "short" ? "short" : "long",
        entry: positive(params.entry),
        stop: positive(params.stop),
        target: positive(params.target),
        note: typeof params.note === "string" ? params.note.slice(0, 2000) : "",
        source: params.source === "ai_setup" ? "ai_setup" : "manual",
      }
    : undefined;
  const [tab, setTab] = useState("trade");
  const [ticket, setTicket] = useState(!!linked);
  const [ticketKey, setTicketKey] = useState(0);
  const [closePosition, setClosePosition] = useState<Position | null>(null);
  const [exits, setExits] = useState<Position | null>(null);
  const [fillLimit, setFillLimit] = useState(20);
  const [orderLimit, setOrderLimit] = useState(20);
  const s = account?.summary;
  const fills = account ? [...account.state.fills].reverse() : [];
  const orders = account ? [...account.state.orders].reverse() : [];
  const pending = orders.filter((order) => order.status === "pending").length;
  const openTicket = (position: Position | null) => {
    setClosePosition(position);
    setTicketKey((value) => value + 1);
    setTicket(true);
  };
  const cards: [string, string, string, number | null][] = s
    ? [
        [
          "账户净值",
          money(Number(s.equity)),
          `${Number(s.return_pct) >= 0 ? "+" : ""}${Number(s.return_pct).toFixed(2)}%`,
          Number(s.total_pnl),
        ],
        [
          "可用资金",
          money(Number(s.available)),
          `已冻结 ${money(Number(s.reserved))}`,
          null,
        ],
        [
          "持仓浮动盈亏 · 未计费用",
          signedMoney(Number(s.unrealized_pnl)),
          `${account!.state.positions.length} 笔持仓`,
          Number(s.unrealized_pnl),
        ],
        [
          "已实现盈亏 · 扣除费用",
          signedMoney(Number(s.realized_pnl)),
          `${s.closed_count} 笔完整平仓 · 胜率 ${s.win_rate === null ? "—" : `${Number(s.win_rate).toFixed(1)}%`}`,
          Number(s.realized_pnl),
        ],
      ]
    : [];
  return (
    <Page
      title="虚拟交易"
      onRefresh={state.sync}
      refreshing={(state.loading || busy) && !!account}
    >
      {!account ? (
        state.loading ? (
          <LoadingStatus label="正在加载虚拟账户">{skeleton}</LoadingStatus>
        ) : (
          <Failure
            message={state.error || "无法加载虚拟账户"}
            retry={() => void state.load()}
          />
        )
      ) : (
        <>
          {!!state.error && !ticket && !exits && (
            <Failure message={state.error} />
          )}
          {!!state.message && <Copy size={14}>{state.message}</Copy>}
          {state.autoSyncFailed ? (
            <Failure message="自动同步未成功，数据可能已过期。" />
          ) : (
            !!account.state.quote_errors?.length && (
              <Failure
                message={`行情暂不可用，以下股票保留上次估值 ${account.state.quote_errors.join(", ")}`}
              />
            )
          )}
          <View
            accessibilityLabel="账户概览"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
          >
            {cards.map(([label, value, detail, tone]) => (
              <Glass
                key={label}
                style={{ flexGrow: 1, flexBasis: "45%", padding: 16, gap: 8 }}
              >
                <Copy size={12} muted>
                  {label}
                </Copy>
                <Copy
                  size={20}
                  bold
                  localize={false}
                  color={tone === null ? undefined : pnlColor(tone)}
                >
                  {value}
                </Copy>
                <Copy size={12} muted>
                  {detail}
                </Copy>
              </Glass>
            ))}
          </View>
          <Button onPress={() => openTicket(null)}>新建虚拟订单</Button>
          <Filters
            values={[
              ["trade", "交易工作台"],
              ["reviews", "学习复盘"],
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "reviews" ? (
            <PaperReviews
              account={account}
              state={state}
              onTrade={() => {
                setTab("trade");
                if (!account.state.positions.length) openTicket(null);
              }}
            />
          ) : (
            <>
              <View style={{ gap: 12 }}>
                <Section title="净值变化" />
                <Glass style={{ padding: 12 }}>
                  <EquityChart snapshots={account.state.snapshots} />
                </Glass>
              </View>
              <View style={{ gap: 12 }}>
                <Section title={`当前持仓 ${account.state.positions.length}`} />
                {!account.state.positions.length && (
                  <Empty
                    title="还没有持仓"
                    message="可以提交虚拟订单，或从股票图表导入 AI 计划。"
                  />
                )}
                {account.state.positions.map((position) => (
                  <PositionCard
                    key={position.id}
                    position={position}
                    account={account}
                    busy={busy}
                    onClose={() => openTicket(position)}
                    onExits={() => setExits(position)}
                    onOpenStock={() =>
                      router.push(
                        `/stock/${encodeURIComponent(position.symbol)}`,
                      )
                    }
                  />
                ))}
              </View>
              <View style={{ gap: 12 }}>
                <Section title={`委托订单 · ${pending} 笔待成交`} />
                {!orders.length && (
                  <Empty
                    title="暂无委托"
                    message="委托、撤单与拒单记录会显示在这里。"
                  />
                )}
                {orders.slice(0, orderLimit).map((order) => (
                  <OrderCard key={order.id} order={order} state={state} />
                ))}
                {orders.length > orderLimit && (
                  <Button onPress={() => setOrderLimit((value) => value + 20)}>
                    加载更多订单
                  </Button>
                )}
              </View>
              <View style={{ gap: 12 }}>
                <Section title="成交账本" />
                {!fills.length && (
                  <Empty
                    title="还没有成交"
                    message="成交后可查看费用、报价时间和已实现盈亏。"
                  />
                )}
                {fills.slice(0, fillLimit).map((fill) => (
                  <FillCard key={fill.id} fill={fill} />
                ))}
                {fills.length > fillLimit && (
                  <Button onPress={() => setFillLimit((value) => value + 20)}>
                    加载更多成交
                  </Button>
                )}
              </View>
            </>
          )}
          <OrderTicketSheet
            key={ticketKey}
            visible={ticket}
            onClose={() => {
              setTicket(false);
              setClosePosition(null);
            }}
            state={state}
            closePosition={
              (closePosition &&
                account.state.positions.find(
                  (position) => position.id === closePosition.id,
                )) ||
              null
            }
            initial={ticketKey === 0 ? linked : undefined}
          />
          <ExitsSheet
            key={exits?.id ?? "none"}
            position={exits}
            onClose={() => setExits(null)}
            state={state}
          />
        </>
      )}
      <Copy size={12} muted>
        仅模拟交易 · 美元股票与 ETF · 无杠杆 · 行情可能延迟。每个账户初始有 10
        万美元虚拟资金。持仓与净值计入可用盘后报价，按常规时段实际观察报价撮合，不补算遗漏的价格路径。净值按账户同步采样，没有新报价时沿用上次估值。
      </Copy>
    </Page>
  );
}
