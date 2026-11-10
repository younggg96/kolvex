import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import * as Crypto from "expo-crypto";
import Svg, { Line, Polyline } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useText } from "../lib/i18n";
import {
  money,
  PAPER_SYMBOL,
  paperAccount,
  PaperApiError,
  paperErrorText,
  paperQuote,
  sendCommand,
  signedMoney,
  type Account,
  type Command,
  type Fill,
  type Order,
  type Position,
  type Quote,
  type Side,
} from "../lib/paperTrading";
import { useTheme } from "../lib/theme";
import { useAuth } from "../state/Auth";
import { usePreferences } from "../state/Preferences";
import { Field, Filters } from "./Content";
import { Button, Copy, Failure, Glass, styles } from "./UI";

export const SIDE_LABELS: Record<Side, string> = {
  long: "多单",
  short: "空单",
};
const KIND_LABELS = { market: "市价", limit: "限价", stop: "突破" } as const;
export function useDateTime() {
  const { locale } = usePreferences();
  return (at: string) =>
    new Date(at).toLocaleString(locale === "en" ? "en-US" : "zh-CN");
}
export function usePnlColor() {
  const t = useTheme();
  return (value: number) =>
    value > 0 ? t.accent : value < 0 ? t.negative : undefined;
}

/**
 * The account, its mutations and a 60s background sync while the app is in front.
 * Responses carry a version, so an older one never replaces a newer one.
 */
export function usePaperAccount() {
  const user = useAuth().session!.user.id;
  const { locale } = usePreferences();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [autoSyncFailed, setAutoSyncFailed] = useState(false);
  const locked = useRef(false);
  const alive = useRef(true);
  const accept = useCallback(
    (next: Account) =>
      setAccount((current) =>
        !current || next.version >= current.version ? next : current,
      ),
    [],
  );
  const errorText = useCallback(
    (value: unknown, context: "read" | "order" = "read") =>
      paperErrorText(value, locale, context),
    [locale],
  );
  // Kept raw so the wording follows the reader's current language.
  const [failure, setFailure] = useState<unknown>(null);
  const read = useCallback(
    (signal?: AbortSignal) =>
      paperAccount(user, signal)
        .then((next) => {
          if (!signal?.aborted) accept(next);
        })
        .catch((e) => {
          if (!signal?.aborted) setFailure(e);
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        }),
    [user, accept],
  );
  const load = () => {
    setLoading(true);
    setError("");
    setFailure(null);
    return read();
  };
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void read(controller.signal);
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [read]);
  async function execute(command: Command): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await sendCommand(command, user);
      if (alive.current) {
        accept(result);
        setAutoSyncFailed(false);
        setMessage(
          command.action === "sync"
            ? "已按可用报价同步账户。"
            : "虚拟账户已更新。",
        );
      }
      return true;
    } catch (e) {
      if (alive.current)
        setError(errorText(e, command.action === "order" ? "order" : "read"));
      return false;
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const ready = !!account;
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(async () => {
      if (AppState.currentState !== "active" || locked.current) return;
      locked.current = true;
      try {
        const result = await sendCommand(
          { action: "sync", request_id: Crypto.randomUUID() },
          user,
        );
        if (alive.current) {
          accept(result);
          setAutoSyncFailed(false);
        }
      } catch {
        if (alive.current) setAutoSyncFailed(true);
      } finally {
        locked.current = false;
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [ready, user, accept]);
  return {
    account,
    loading,
    busy,
    error: error || (failure ? errorText(failure) : ""),
    message,
    autoSyncFailed,
    load,
    execute,
    errorText,
    sync: () =>
      account
        ? void execute({ action: "sync", request_id: Crypto.randomUUID() })
        : void load(),
  };
}
export type PaperAccountState = ReturnType<typeof usePaperAccount>;

/** A focused task that ends: Cancel at the top left, content scrolls above the keyboard. */
export function Sheet({
  title,
  visible,
  onClose,
  locked = false,
  children,
}: PropsWithChildren<{
  title: string;
  visible: boolean;
  onClose: () => void;
  locked?: boolean;
}>) {
  const t = useTheme();
  const text = useText();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!locked) onClose();
      }}
    >
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: 56,
            paddingHorizontal: 12,
            paddingTop: Platform.OS === "android" ? insets.top : 0,
            borderBottomWidth: 1,
            borderColor: t.border,
          }}
        >
          <Pressable
            accessibilityRole="button"
            disabled={locked}
            onPress={onClose}
            style={{
              minWidth: 64,
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 8,
              opacity: locked ? 0.45 : 1,
            }}
          >
            <Copy color={t.accent}>取消</Copy>
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Copy bold lines={1}>
              {text(title)}
            </Copy>
          </View>
          <View style={{ minWidth: 64 }} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            padding: 24,
            paddingBottom: insets.bottom + 32,
            gap: 16,
          }}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={{ flexShrink: 1 }}>
        <Copy size={14} muted>
          {label}
        </Copy>
      </View>
      <Copy size={14} localize={false}>
        {value}
      </Copy>
    </View>
  );
}

export type TicketDraft = {
  symbol?: string;
  side?: Side;
  entry?: string;
  stop?: string;
  target?: string;
  note?: string;
  source?: "manual" | "ai_setup";
};
type Kind = "market" | "limit" | "stop";
export function OrderTicketSheet({
  visible,
  onClose,
  state,
  closePosition,
  fixedSymbol,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  state: PaperAccountState;
  closePosition: Position | null;
  fixedSymbol?: string;
  /** An editable plan carried by a link. Neither a quote nor an order. */
  initial?: TicketDraft;
}) {
  const account = state.account!;
  const { busy, execute, errorText } = state;
  const user = useAuth().session!.user.id;
  const dateTime = useDateTime();
  const [symbol, setSymbol] = useState(initial?.symbol || "AAPL");
  const [side, setSide] = useState<Side>(initial?.side ?? "long");
  // The sheet is remounted for each lot, so a background sync never resets an edited ticket.
  const [kind, setKind] = useState<Kind>(
    initial?.entry && !closePosition ? "limit" : "market",
  );
  const [quantity, setQuantity] = useState(
    closePosition ? String(closePosition.quantity) : "",
  );
  const [price, setPrice] = useState(initial?.entry ?? "");
  const [stop, setStop] = useState(initial?.stop ?? "");
  const [target, setTarget] = useState(initial?.target ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [source, setSource] = useState(initial?.source ?? "manual");
  const [fetched, setFetched] = useState<{
    symbol: string;
    quote: Quote | null;
    error: string;
    request: string;
  }>({ symbol: "", quote: null, error: "", request: "" });
  const [attempt, setAttempt] = useState(0);
  const [validation, setValidation] = useState("");
  const [draft, setDraft] = useState<Command | null>(null);
  const chosenSymbol = closePosition?.symbol || fixedSymbol || symbol;
  const chosenSide = closePosition?.side || side;
  const validSymbol = PAPER_SYMBOL.test(chosenSymbol);
  const polling = visible && !busy && !draft && validSymbol;
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") setAttempt((value) => value + 1);
    }, 15_000);
    return () => clearInterval(timer);
  }, [polling]);
  const requestKey = `${chosenSymbol}:${attempt}`;
  // A quote belongs to its symbol; a failed refresh keeps the last one visible.
  const quote = fetched.symbol === chosenSymbol ? fetched.quote : null;
  const quoteError = fetched.symbol === chosenSymbol ? fetched.error : "";
  const quoteLoading = visible && validSymbol && fetched.request !== requestKey;
  const quoteFailed = useEffectEvent((error: unknown, key: string) =>
    setFetched((old) => ({
      symbol: chosenSymbol,
      quote: old.symbol === chosenSymbol ? old.quote : null,
      error: errorText(error),
      request: key,
    })),
  );
  useEffect(() => {
    if (!visible || !validSymbol) return;
    const controller = new AbortController();
    const key = `${chosenSymbol}:${attempt}`;
    const timer = setTimeout(() => {
      paperQuote(chosenSymbol, user, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted)
            setFetched({
              symbol: chosenSymbol,
              quote: next,
              error: "",
              request: key,
            });
        })
        .catch((error) => {
          if (!controller.signal.aborted) quoteFailed(error, key);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [chosenSymbol, attempt, visible, validSymbol, user]);

  const q = Number(quantity);
  const reference = kind === "market" ? Number(quote?.price) : Number(price);
  const estimate = q > 0 && reference > 0 ? q * reference : 0;
  const risk =
    stop && reference > 0 ? Math.abs(reference - Number(stop)) * q : null;
  const reservedQuantity = closePosition
    ? account.state.orders
        .filter(
          (o) => o.status === "pending" && o.position_id === closePosition.id,
        )
        .reduce((sum, o) => sum + o.quantity, 0)
    : 0;
  function review() {
    const wrongSide = (value: string, loss: boolean) =>
      !Number.isFinite(Number(value)) ||
      Number(value) <= 0 ||
      ((chosenSide === "long") === loss
        ? Number(value) >= reference
        : Number(value) <= reference);
    const invalid = (
      [
        [!validSymbol, "请输入有效的股票代码。"],
        [
          !Number.isInteger(q) || q <= 0 || q > 1000000,
          "股数须为 1 至 1,000,000 的整数。",
        ],
        [!quote, "请先获取有效的美元股票报价。"],
        [
          kind === "market" &&
            (!quote?.tradable ||
              Date.now() - new Date(quote.at).getTime() > 1200000),
          "市价单需要常规时段内的新报价。请使用挂单，或在交易时段刷新行情。",
        ],
        [
          !Number.isFinite(reference) || reference <= 0,
          "请输入大于零的委托价。",
        ],
        [
          !!closePosition && q > closePosition.quantity - reservedQuantity,
          "可平仓股数不足，部分股数可能已被平仓挂单冻结，请先撤单。",
        ],
        [
          !closePosition &&
            estimate * 1.00060005 > Number(account.summary.available),
          "可用资金不足以覆盖本金、预计费用与滑点。",
        ],
        [
          !closePosition && !!stop && wrongSide(stop, true),
          "多单止损须低于入场价，空单止损须高于入场价。",
        ],
        [
          !closePosition && !!target && wrongSide(target, false),
          "多单止盈须高于入场价，空单止盈须低于入场价。",
        ],
      ] as [boolean, string][]
    ).find(([failed]) => failed);
    if (invalid) {
      setValidation(invalid[1]);
      return;
    }
    setValidation("");
    setDraft({
      action: "order",
      request_id: Crypto.randomUUID(),
      symbol: chosenSymbol,
      side: chosenSide,
      effect: closePosition ? "close" : "open",
      position_id: closePosition?.id,
      quantity: q,
      kind,
      price: kind === "market" ? null : reference,
      stop_loss: closePosition || !stop ? null : Number(stop),
      take_profit: closePosition || !target ? null : Number(target),
      note,
      source,
    });
  }
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (validation) setValidation("");
  };
  const dismiss = () => {
    setDraft(null);
    setValidation("");
    onClose();
  };
  if (draft)
    return (
      <Sheet
        title="提交虚拟订单"
        visible={visible}
        onClose={dismiss}
        locked={busy}
      >
        <Copy size={14} muted>
          此订单仅使用虚拟资金，报价与成交可能与券商不同。
        </Copy>
        <Glass style={{ padding: 20, gap: 12 }}>
          <Copy size={20} bold>{`${draft.symbol} · ${draft.quantity} 股`}</Copy>
          <Row
            label={
              draft.effect === "close"
                ? "平仓"
                : draft.side === "long"
                  ? "开多"
                  : "开空"
            }
            value={
              draft.kind === "market" || !draft.price ? "—" : money(draft.price)
            }
          />
          <Copy size={14}>
            {draft.kind === "market"
              ? "市价 · 按有效观察报价成交"
              : draft.kind === "limit"
                ? "限价单 · GTC"
                : "突破单 · GTC"}
          </Copy>
          <Row
            label="止损"
            value={draft.stop_loss ? money(draft.stop_loss) : "—"}
          />
          <Row
            label="止盈"
            value={draft.take_profit ? money(draft.take_profit) : "—"}
          />
        </Glass>
        <Copy size={12} muted>
          挂单保留至成交或撤单。遇到网络错误时，请在此重试同一订单以避免重复。
        </Copy>
        {!!state.error && <Failure message={state.error} />}
        <Button
          disabled={busy}
          onPress={async () => {
            if (await execute(draft)) {
              setQuantity("");
              dismiss();
            }
          }}
        >
          {busy ? "提交中…" : "提交虚拟订单"}
        </Button>
        <Button disabled={busy} onPress={() => setDraft(null)}>
          返回修改
        </Button>
      </Sheet>
    );
  return (
    <Sheet
      title={closePosition ? "平仓" : "虚拟下单"}
      visible={visible}
      onClose={dismiss}
    >
      {source === "ai_setup" && !closePosition && (
        <Copy size={14} muted>
          已导入 AI 计划草稿，请检查方向、订单类型与风险后再下单。
        </Copy>
      )}
      {closePosition ? (
        <Copy size={20} bold>
          {`平仓 ${chosenSymbol} · ${SIDE_LABELS[chosenSide]}`}
        </Copy>
      ) : (
        <>
          {fixedSymbol ? (
            <Copy size={20} bold localize={false}>
              {fixedSymbol}
            </Copy>
          ) : (
            <Field
              label="股票代码"
              value={symbol}
              maxLength={16}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              onChangeText={(value) => {
                edit(setSymbol)(value.toUpperCase());
                setSource("manual");
              }}
            />
          )}
          <Filters
            values={[
              ["long", "买入做多"],
              ["short", "卖出做空"],
            ]}
            value={side}
            onChange={(value) => setSide(value as Side)}
          />
        </>
      )}
      <View accessibilityLiveRegion="polite" style={{ gap: 4, minHeight: 72 }}>
        {quote ? (
          <>
            <Copy size={24} bold localize={false}>
              {money(Number(quote.price))}
            </Copy>
            <Copy size={12} muted>{`报价时间：${dateTime(quote.at)}`}</Copy>
            <Copy size={12} muted>
              {quote.session === "post"
                ? "盘后 · 计入估值 · 仅挂单"
                : quote.tradable
                  ? "常规时段 · 可能延迟"
                  : "休市或报价过期 · 仅挂单"}
            </Copy>
            {!!quoteError && (
              <Copy size={12} muted>
                当前保留上次报价
              </Copy>
            )}
          </>
        ) : quoteLoading ? (
          <Copy size={14} muted>
            正在获取报价…
          </Copy>
        ) : (
          <Failure message={quoteError || "输入股票代码获取报价。"} />
        )}
      </View>
      <Button
        disabled={quoteLoading || busy}
        onPress={() => setAttempt((value) => value + 1)}
      >
        刷新行情
      </Button>
      <View style={{ gap: 8 }}>
        <Copy size={14} bold>
          订单类型
        </Copy>
        <Filters
          values={[
            ["market", "市价单"],
            ["limit", "限价单 · GTC"],
            ["stop", "突破单 · GTC"],
          ]}
          value={kind}
          onChange={(value) => {
            setKind(value as Kind);
            if (validation) setValidation("");
          }}
        />
      </View>
      <Field
        label="股数"
        value={quantity}
        onChangeText={edit(setQuantity)}
        keyboardType="number-pad"
        returnKeyType="done"
      />
      {kind !== "market" && (
        <View style={{ gap: 4 }}>
          <Field
            label={kind === "limit" ? "限价（美元）" : "突破触发价（美元）"}
            value={price}
            onChangeText={edit(setPrice)}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
          <Copy size={12} muted>
            {kind === "stop"
              ? "价格沿交易方向突破后，按观察价加模拟滑点成交。"
              : "有效报价到达限价后，以限价或更优价格成交。"}
          </Copy>
        </View>
      )}
      {!closePosition && (
        <>
          <Field
            label="止损价 · 选填"
            value={stop}
            onChangeText={edit(setStop)}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
          <Field
            label="止盈价 · 选填"
            value={target}
            onChangeText={edit(setTarget)}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </>
      )}
      <Field
        label="交易理由"
        value={note}
        onChangeText={setNote}
        maxLength={2000}
        multiline
        placeholder="什么证据支持这笔交易？什么情况说明判断失效？"
        style={{ minHeight: 88, textAlignVertical: "top" }}
      />
      <View style={{ gap: 8 }}>
        <Row
          label="可用资金"
          value={money(Number(account.summary.available))}
        />
        <Row label="预计交易金额" value={money(estimate)} />
        {!closePosition && risk !== null && (
          <Row
            label="到止损的风险 · 未计费用"
            value={`${money(risk)} · ${((risk / Number(account.summary.equity)) * 100).toFixed(2)}%`}
          />
        )}
      </View>
      <Copy size={12} muted>
        每次成交收取 0.01% 模拟费用。市价与突破成交增加 0.05% 不利滑点。空单使用
        100% 现金抵押，止损可能跳空。
      </Copy>
      {!!validation && <Failure message={validation} />}
      <Button disabled={busy || quoteLoading || !quote} onPress={review}>
        检查虚拟订单
      </Button>
    </Sheet>
  );
}

export function ExitsSheet({
  position,
  onClose,
  state,
}: {
  position: Position | null;
  onClose: () => void;
  state: PaperAccountState;
}) {
  // Callers key this sheet by the lot, so each lot starts from its own exits.
  const [stop, setStop] = useState(position?.stop_loss || "");
  const [target, setTarget] = useState(position?.take_profit || "");
  const [error, setError] = useState("");
  return (
    <Sheet
      title="修改止损止盈"
      visible={!!position}
      onClose={onClose}
      locked={state.busy}
    >
      <Copy size={20} bold localize={false}>
        {position?.symbol ?? ""}
      </Copy>
      <Copy size={14} muted>
        应用于该笔剩余持仓。清空字段可移除对应条件，价格须位于最新估值的正确方向。
      </Copy>
      <Field
        label="止损价"
        value={stop}
        onChangeText={setStop}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />
      <Field
        label="止盈价"
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />
      {!!error && <Failure message={error} />}
      {!!error && !!state.error && <Failure message={state.error} />}
      <Button
        disabled={state.busy}
        onPress={async () => {
          if (!position) return;
          if (
            [stop, target].some(
              (v) => v && (!Number.isFinite(Number(v)) || Number(v) <= 0),
            )
          ) {
            setError("请输入正数价格，或留空。");
            return;
          }
          if (
            await state.execute({
              action: "bracket",
              request_id: Crypto.randomUUID(),
              position_id: position.id,
              stop_loss: stop ? Number(stop) : null,
              take_profit: target ? Number(target) : null,
            })
          )
            onClose();
          else setError("未能更新，请查看账户错误提示后重试。");
        }}
      >
        保存止损止盈
      </Button>
    </Sheet>
  );
}

function Cell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={{ width: "50%", paddingRight: 8, gap: 2 }}>
      <Copy size={12} muted>
        {label}
      </Copy>
      <Copy size={14} color={color} localize={false}>
        {value}
      </Copy>
    </View>
  );
}
const grid = { flexDirection: "row", flexWrap: "wrap", rowGap: 12 } as const;
function SideTag({ side }: { side: Side }) {
  const t = useTheme();
  return (
    <Copy size={12} bold color={side === "long" ? t.accent : t.negative}>
      {SIDE_LABELS[side]}
    </Copy>
  );
}
export function PositionCard({
  position,
  account,
  busy,
  onClose,
  onExits,
  onOpenStock,
}: {
  position: Position;
  account: Account;
  busy: boolean;
  onClose: () => void;
  onExits: () => void;
  onOpenStock?: () => void;
}) {
  const dateTime = useDateTime();
  const pnlColor = usePnlColor();
  const mark = account.state.marks[position.symbol];
  const pnl =
    (Number(mark?.price || position.entry_price) -
      Number(position.entry_price)) *
    position.quantity *
    (position.side === "long" ? 1 : -1);
  return (
    <Glass style={{ padding: 16, gap: 12 }}>
      <View style={styles.row}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Copy
            size={18}
            bold
            localize={false}
            onPress={onOpenStock}
            role={onOpenStock ? "link" : undefined}
          >
            {position.symbol}
          </Copy>
          <SideTag side={position.side} />
        </View>
        <Copy size={16} bold localize={false} color={pnlColor(pnl)}>
          {signedMoney(pnl)}
        </Copy>
      </View>
      <View style={grid}>
        <Cell
          label="股数 / 成本"
          value={`${position.quantity} · ${money(Number(position.entry_price))}`}
        />
        <Cell
          label={mark?.session === "post" ? "盘后估值" : "估值"}
          value={money(Number(mark?.price || position.entry_price))}
        />
        <Cell
          label="止损 / 止盈"
          value={`${position.stop_loss ? money(Number(position.stop_loss)) : "—"} / ${position.take_profit ? money(Number(position.take_profit)) : "—"}`}
        />
        <Cell label="报价时间" value={mark ? dateTime(mark.at) : "—"} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button disabled={busy} onPress={onClose}>
          平仓
        </Button>
        <Button disabled={busy} onPress={onExits}>
          修改止损止盈
        </Button>
      </View>
    </Glass>
  );
}
const STATUS_LABELS = {
  pending: "待成交",
  filled: "已成交",
  cancelled: "已撤销",
  rejected: "已拒绝",
} as const;
export function OrderCard({
  order,
  state,
}: {
  order: Order;
  state: PaperAccountState;
}) {
  const dateTime = useDateTime();
  const shown = order.fill_price || order.price;
  return (
    <Glass style={{ padding: 16, gap: 12 }}>
      <View style={styles.row}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Copy size={16} bold localize={false}>
            {order.symbol}
          </Copy>
          <Copy size={12} muted>
            {order.effect === "close" ? "平仓" : "开仓"}
          </Copy>
          <SideTag side={order.side} />
        </View>
        <Copy size={12} bold muted={order.status !== "pending"}>
          {STATUS_LABELS[order.status]}
        </Copy>
      </View>
      <View style={grid}>
        <Cell
          label={KIND_LABELS[order.kind]}
          value={`${shown ? money(Number(shown)) : "—"} / ${order.quantity}`}
        />
        <Cell label="委托时间" value={dateTime(order.created_at)} />
      </View>
      {!!order.rejection && (
        <Failure
          message={state.errorText(new PaperApiError(order.rejection, 422))}
        />
      )}
      {order.status === "pending" && (
        <Button
          disabled={state.busy}
          onPress={() =>
            void state.execute({
              action: "cancel",
              request_id: Crypto.randomUUID(),
              order_id: order.id,
            })
          }
        >
          撤单
        </Button>
      )}
    </Glass>
  );
}
const REASON_LABELS: Record<string, string> = {
  order: "用户委托",
  stop_loss: "止损",
  take_profit: "止盈",
  margin: "抵押耗尽强平",
};
export function FillCard({ fill }: { fill: Fill }) {
  const dateTime = useDateTime();
  const pnlColor = usePnlColor();
  const [open, setOpen] = useState(false);
  const close = fill.effect === "close";
  return (
    <Glass style={{ padding: 16, gap: 12 }}>
      <View style={styles.row}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Copy size={16} bold localize={false}>
            {fill.symbol}
          </Copy>
          <Copy size={12} muted>
            {close ? "平仓" : "开仓"}
          </Copy>
          <SideTag side={fill.side} />
        </View>
        <Copy
          size={14}
          bold
          localize={false}
          color={close ? pnlColor(Number(fill.realized_pnl)) : undefined}
        >
          {close ? signedMoney(Number(fill.realized_pnl)) : "—"}
        </Copy>
      </View>
      <View style={grid}>
        <Cell
          label="成交价 / 股数"
          value={`${money(Number(fill.price))} / ${fill.quantity}`}
        />
        <Cell label="费用" value={money(Number(fill.fee))} />
        <Cell label="成交时间" value={dateTime(fill.at)} />
        <Cell label="报价时间" value={dateTime(fill.quote_at)} />
      </View>
      <Copy size={12} muted>
        {REASON_LABELS[fill.reason] || fill.reason}
      </Copy>
      {!!fill.note && (
        <>
          <Copy
            size={12}
            muted
            role="link"
            onPress={() => setOpen((value) => !value)}
          >
            {open ? "收起交易理由" : "交易理由"}
          </Copy>
          {open && (
            <Copy size={13} selectable>
              {fill.note}
            </Copy>
          )}
        </>
      )}
    </Glass>
  );
}

export function EquityChart({
  snapshots,
}: {
  snapshots: { at: string; equity: string }[];
}) {
  const t = useTheme();
  const text = useText();
  const dateTime = useDateTime();
  if (snapshots.length < 2)
    return (
      <Copy size={14} muted>
        首次同步或交易后开始记录净值曲线。
      </Copy>
    );
  const values = snapshots.map((s) => Number(s.equity));
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || Math.max(high * 0.001, 1);
  const times = snapshots.map((s) => new Date(s.at).getTime());
  const span = times[times.length - 1] - times[0] || 1;
  const points = values
    .map(
      (value, i) =>
        `${8 + ((times[i] - times[0]) / span) * 304},${168 - ((value - low) / range) * 144}`,
    )
    .join(" ");
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${text("净值变化")} ${money(values[0])} → ${money(values[values.length - 1])}`}
      style={{ gap: 4 }}
    >
      <View style={styles.row}>
        <Copy size={12} muted localize={false}>
          {money(low)}
        </Copy>
        <Copy size={12} muted localize={false}>
          {money(high)}
        </Copy>
      </View>
      <Svg width="100%" height={180} viewBox="0 0 320 192" accessible={false}>
        <Line x1={8} x2={312} y1={176} y2={176} stroke={t.border} />
        <Polyline
          points={points}
          fill="none"
          stroke={
            values[values.length - 1] >= values[0] ? t.chartUp : t.chartDown
          }
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>
      <View style={styles.row}>
        <Copy size={12} muted localize={false}>
          {dateTime(snapshots[0].at)}
        </Copy>
        <Copy size={12} muted localize={false}>
          {dateTime(snapshots[snapshots.length - 1].at)}
        </Copy>
      </View>
    </View>
  );
}
