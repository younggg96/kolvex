import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { signedMoney, type Position } from "../lib/paperTrading";
import { stockPaperTrading } from "../lib/stockPaperTrading";
import { AuthGate } from "./Content";
import {
  ExitsSheet,
  FillCard,
  OrderCard,
  OrderTicketSheet,
  PositionCard,
  usePaperAccount,
  usePnlColor,
} from "./PaperTrading";
import { CardsSkeleton } from "./Skeletons";
import {
  Button,
  Copy,
  Empty,
  Failure,
  Glass,
  LoadingStatus,
  Section,
} from "./UI";

const skeleton = (
  <CardsSkeleton
    count={2}
    padding={16}
    gap={8}
    lines={[
      { size: 12, width: "40%" },
      { size: 18, width: "50%" },
    ]}
  />
);
/** This symbol's private lots, orders and executions; the account is the trading desk's. */
export function StockPaperTrading({ symbol }: { symbol: string }) {
  return (
    <AuthGate title="虚拟交易" inline skeleton={skeleton}>
      <Trades symbol={symbol} />
    </AuthGate>
  );
}
function Trades({ symbol }: { symbol: string }) {
  const state = usePaperAccount();
  const { account, busy } = state;
  const pnlColor = usePnlColor();
  const [ticket, setTicket] = useState(false);
  const [ticketKey, setTicketKey] = useState(0);
  const [closePosition, setClosePosition] = useState<Position | null>(null);
  const [exits, setExits] = useState<Position | null>(null);
  const [limit, setLimit] = useState(10);
  if (!account)
    return state.loading ? (
      <LoadingStatus label="正在加载我的虚拟交易">{skeleton}</LoadingStatus>
    ) : (
      <Failure
        message={state.error || "无法加载虚拟交易"}
        retry={() => void state.load()}
      />
    );
  const data = stockPaperTrading(account, symbol);
  const openTicket = (position: Position | null) => {
    setClosePosition(position);
    setTicketKey((value) => value + 1);
    setTicket(true);
  };
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button size="sm" onPress={() => openTicket(null)}>
          模拟下单
        </Button>
        <Button size="sm" disabled={busy} onPress={state.sync}>
          刷新
        </Button>
        <Button size="sm" onPress={() => router.push("/paper-trading")}>
          全部虚拟交易
        </Button>
      </View>
      {!!state.error && !ticket && !exits && <Failure message={state.error} />}
      {!!state.message && <Copy size={14}>{state.message}</Copy>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {(
          [
            [
              "持仓浮盈亏 · 未计费用",
              signedMoney(data.unrealizedPnl),
              data.unrealizedPnl,
            ],
            [
              "已实现盈亏 · 扣除费用",
              signedMoney(data.realizedPnl),
              data.realizedPnl,
            ],
            ["待成交委托", String(data.orders.length), 0],
          ] as const
        ).map(([label, value, tone]) => (
          <Glass
            key={label}
            style={{ flexGrow: 1, flexBasis: "45%", padding: 16, gap: 4 }}
          >
            <Copy size={12} muted>
              {label}
            </Copy>
            <Copy size={18} bold localize={false} color={pnlColor(tone)}>
              {value}
            </Copy>
          </Glass>
        ))}
      </View>
      <Section title={`我的持仓 ${data.positions.length}`} />
      {!data.positions.length && (
        <Empty title="暂无持仓" message="这只股票还没有虚拟持仓。" />
      )}
      {data.positions.map((position) => (
        <PositionCard
          key={position.id}
          position={position}
          account={account}
          busy={busy}
          onClose={() => openTicket(position)}
          onExits={() => setExits(position)}
        />
      ))}
      {!!data.orders.length && (
        <>
          <Section title="我的挂单" />
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} state={state} />
          ))}
        </>
      )}
      {!!data.fills.length && (
        <>
          <Section title={`我的成交 ${data.fills.length}`} />
          {data.fills.slice(0, limit).map((fill) => (
            <FillCard key={fill.id} fill={fill} />
          ))}
          {data.fills.length > limit && (
            <Button size="sm" onPress={() => setLimit((value) => value + 10)}>
              加载更多成交
            </Button>
          )}
        </>
      )}
      <Copy size={12} muted>
        仅使用虚拟资金，与虚拟交易工作台共用同一账户。
      </Copy>
      <OrderTicketSheet
        key={ticketKey}
        visible={ticket}
        onClose={() => {
          setTicket(false);
          setClosePosition(null);
        }}
        state={state}
        fixedSymbol={symbol}
        closePosition={
          (closePosition &&
            account.state.positions.find(
              (position) => position.id === closePosition.id,
            )) ||
          null
        }
      />
      <ExitsSheet
        key={exits?.id ?? "none"}
        position={exits}
        onClose={() => setExits(null)}
        state={state}
      />
    </View>
  );
}
