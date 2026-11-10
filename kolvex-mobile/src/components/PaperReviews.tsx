import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import {
  money,
  paperReviews,
  publishReview,
  signedMoney,
  withdrawReview,
  type Account,
  type Fill,
  type Review,
} from "../lib/paperTrading";
import { paperTradingReviews } from "../lib/paperTradingReviews";
import { useTheme } from "../lib/theme";
import { useAuth } from "../state/Auth";
import { usePreferences } from "../state/Preferences";
import { ConfirmAction } from "./ConfirmAction";
import { Field } from "./Content";
import {
  Sheet,
  SIDE_LABELS,
  useDateTime,
  usePnlColor,
  type PaperAccountState,
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
  styles,
} from "./UI";

function Fills({ fills }: { fills: Fill[] }) {
  const dateTime = useDateTime();
  return (
    <View style={{ gap: 8 }}>
      {fills.map((fill) => (
        <View key={fill.id} style={{ gap: 2 }}>
          <Copy size={12} muted localize={false}>
            {dateTime(fill.at)}
          </Copy>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8 }}
          >
            <Copy size={13}>{fill.effect === "open" ? "开仓" : "平仓"}</Copy>
            <Copy size={13} localize={false}>
              {fill.quantity} × {money(Number(fill.price))}
            </Copy>
            <Copy size={13} muted>{`费用 ${money(Number(fill.fee))}`}</Copy>
          </View>
        </View>
      ))}
    </View>
  );
}
function Disclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setOpen((value) => !value)} selected={open}>
        {label}
      </Button>
      {open && children}
    </>
  );
}

/** The private journal of this account's lots, then the shared learning feed. */
export function PaperReviews({
  account,
  state,
  onTrade,
}: {
  account: Account;
  state: PaperAccountState;
  onTrade: () => void;
}) {
  const t = useTheme();
  const user = useAuth().session!.user.id;
  const { locale } = usePreferences();
  const dateTime = useDateTime();
  const pnlColor = usePnlColor();
  const [items, setItems] = useState<Review[]>([]);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [feed, setFeed] = useState({ key: "", error: "" });
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  const [offset, setOffset] = useState(0);
  const [tradeLimit, setTradeLimit] = useState(20);
  const lock = useRef(false);
  const failed = useEffectEvent((e: unknown, key: string) =>
    setFeed({ key, error: state.errorText(e) }),
  );
  const trades = useMemo(() => paperTradingReviews(account), [account]);
  const selected = trades.find(
    (trade) => trade.completed && trade.id === position,
  );
  const publishedNote = items.find(
    (item) =>
      item.is_mine &&
      item.snapshot.fills.some((fill) => fill.position_id === position),
  )?.note;
  const note = drafts[position] ?? publishedNote ?? "";
  const feedKey = `${attempt}:${offset}`;
  const loading = feed.key !== feedKey;
  const feedError = loading ? "" : feed.error;
  const refresh = () => {
    setOffset(0);
    setAttempt((value) => value + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    paperReviews(offset, user, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setItems((current) =>
          offset > 0
            ? [
                ...current,
                ...page.items.filter(
                  (item) => !current.some((x) => x.id === item.id),
                ),
              ]
            : page.items,
        );
        setHasMore(page.has_more);
        setFeed({ key: `${attempt}:${offset}`, error: "" });
      })
      .catch((e) => {
        if (!controller.signal.aborted) failed(e, `${attempt}:${offset}`);
      });
    return () => controller.abort();
  }, [attempt, offset, user]);
  async function mutate(work: () => Promise<unknown>, done: string) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      refresh();
      setMessage(done);
      return true;
    } catch (e) {
      setError(state.errorText(e));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 24 }}>
      {!!error && !position && <Failure message={error} />}
      {!!message && <Copy size={14}>{message}</Copy>}
      <View style={{ gap: 12 }}>
        <Section title={`我的交易复盘 · ${trades.length}`} />
        {!trades.length && (
          <>
            <Empty
              title="还没有可复盘的成交"
              message="成交后可在这里回看入场依据、成交与结果。"
            />
            <Button onPress={onTrade}>前往交易工作台</Button>
          </>
        )}
        {trades.slice(0, tradeLimit).map((trade) => {
          const pnl = trade.completed ? trade.realizedPnl : trade.unrealizedPnl;
          return (
            <Glass key={trade.id} style={{ padding: 16, gap: 12 }}>
              <View style={styles.row}>
                <View style={{ gap: 2, flexShrink: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      gap: 8,
                    }}
                  >
                    <Copy size={18} bold localize={false}>
                      {trade.symbol}
                    </Copy>
                    <Copy
                      size={12}
                      bold
                      color={trade.side === "long" ? t.accent : t.negative}
                    >
                      {SIDE_LABELS[trade.side]}
                    </Copy>
                    <Copy size={12} muted>
                      {trade.completed ? "已完全平仓" : "持仓中"}
                    </Copy>
                  </View>
                  <Copy size={12} muted>
                    {`开仓于 ${dateTime(trade.openedAt)}`}
                  </Copy>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Copy size={16} bold localize={false} color={pnlColor(pnl)}>
                    {signedMoney(pnl)}
                  </Copy>
                  <Copy size={12} muted>
                    {trade.completed
                      ? "净盈亏 · 虚拟交易"
                      : "持仓浮盈亏 · 未计费用"}
                  </Copy>
                </View>
              </View>
              <View style={{ gap: 4 }}>
                <Copy size={12} muted>
                  入场依据
                </Copy>
                {trade.thesis ? (
                  <Copy size={14} selectable>
                    {trade.thesis}
                  </Copy>
                ) : (
                  <Copy size={14} muted>
                    下单时没有填写交易理由。
                  </Copy>
                )}
              </View>
              <Disclosure
                label={`查看成交记录 · ${trade.fills.length} · 费用 ${money(trade.fees)}`}
              >
                <Fills fills={trade.fills} />
                {!trade.completed && (
                  <Copy size={12} muted>
                    {`已实现净盈亏 ${signedMoney(trade.realizedPnl)}`}
                  </Copy>
                )}
                {!trade.completed && !trade.markAt && (
                  <Copy size={12} muted>
                    暂无报价，按入场价估值。
                  </Copy>
                )}
              </Disclosure>
              {trade.completed ? (
                <Button
                  disabled={busy}
                  onPress={() => {
                    setError("");
                    setMessage("");
                    setPosition(trade.id);
                  }}
                >
                  撰写公开复盘
                </Button>
              ) : (
                <Copy size={12} muted>
                  持仓期间可在此回看交易；完全平仓后会开放撰写公开复盘入口。
                </Copy>
              )}
            </Glass>
          );
        })}
        {trades.length > tradeLimit && (
          <Button onPress={() => setTradeLimit((value) => value + 20)}>
            加载更多交易
          </Button>
        )}
      </View>
      <View style={{ gap: 12 }}>
        <Section title="公开学习复盘" />
        {!!feedError && <Failure message={feedError} retry={refresh} />}
        {loading && !items.length ? (
          <LoadingStatus label="正在加载公开复盘">
            <CardsSkeleton
              count={2}
              lines={[
                { size: 18, width: "30%" },
                { size: 12, width: "50%" },
                { size: 14, lines: 2, width: "70%" },
              ]}
            />
          </LoadingStatus>
        ) : !items.length && !feedError ? (
          <Empty title="还没有公开复盘" message="完全平仓后可以发布第一篇。" />
        ) : (
          items.map((item) => (
            <Glass key={item.id} style={{ padding: 16, gap: 12 }}>
              <View style={styles.row}>
                <View style={{ gap: 2, flexShrink: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      gap: 8,
                    }}
                  >
                    <Copy size={18} bold localize={false}>
                      {item.snapshot.symbol}
                    </Copy>
                    <Copy
                      size={12}
                      bold
                      color={
                        item.snapshot.side === "long" ? t.accent : t.negative
                      }
                    >
                      {SIDE_LABELS[item.snapshot.side]}
                    </Copy>
                  </View>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                  >
                    {item.is_mine ? (
                      <Copy size={12} muted>
                        我的复盘
                      </Copy>
                    ) : (
                      <Copy size={12} muted localize={false}>
                        {locale === "en"
                          ? item.author
                          : item.author.replace("Learner", "学习者")}
                      </Copy>
                    )}
                    <Copy size={12} muted localize={false}>
                      · {dateTime(item.published_at)}
                    </Copy>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Copy
                    size={16}
                    bold
                    localize={false}
                    color={pnlColor(Number(item.snapshot.realized_pnl))}
                  >
                    {signedMoney(Number(item.snapshot.realized_pnl))}
                  </Copy>
                  <Copy size={12} muted>
                    净盈亏 · 虚拟交易
                  </Copy>
                </View>
              </View>
              <Copy size={14} selectable>
                {item.note}
              </Copy>
              <Disclosure
                label={`查看成交依据 · 费用 ${money(Number(item.snapshot.fees))}`}
              >
                <Fills fills={item.snapshot.fills} />
              </Disclosure>
              {item.is_mine && (
                <ConfirmAction
                  label="撤回公开复盘"
                  description="复盘将从学习动态中移除，个人成交账本仍会保留。"
                  disabled={busy}
                  onConfirm={() =>
                    void mutate(
                      () => withdrawReview(item.id, user),
                      "已撤回复盘。",
                    )
                  }
                />
              )}
            </Glass>
          ))
        )}
        {hasMore && (
          <Button disabled={loading} onPress={() => setOffset(items.length)}>
            加载更多复盘
          </Button>
        )}
      </View>
      <Sheet
        title="发布交易复盘"
        visible={!!selected}
        onClose={() => setPosition("")}
        locked={busy}
      >
        <Copy size={14} muted>
          其他已登录学习者可以看到复盘、交易理由、成交、费用与净盈亏，不包含账户余额。之后可以撤回。
        </Copy>
        {selected && (
          <Glass style={{ padding: 16, gap: 4 }}>
            <Copy bold>
              {`${selected.symbol} · ${SIDE_LABELS[selected.side]}`}
            </Copy>
            <Copy size={12} muted>
              {`净盈亏 ${signedMoney(selected.realizedPnl)} · 费用 ${money(selected.fees)}`}
            </Copy>
          </Glass>
        )}
        <Field
          label="这笔交易学到了什么？"
          value={note}
          onChangeText={(value) =>
            setDrafts((current) => ({ ...current, [position]: value }))
          }
          multiline
          maxLength={4000}
          placeholder="记录入场依据、退出原因与一个改进点，至少 10 个字。"
          style={{ minHeight: 120, textAlignVertical: "top" }}
        />
        <Copy size={12} muted>
          至少 10 个字，确认后才会公开。再次发布同一持仓将更新已有复盘。
        </Copy>
        {!!error && <Failure message={error} />}
        <Button
          disabled={busy || !selected || note.trim().length < 10}
          onPress={async () => {
            const id = position;
            if (
              await mutate(
                () => publishReview(id, note.trim(), user),
                "复盘已向其他学习者公开。",
              )
            ) {
              setPosition("");
              setDrafts((current) => {
                const next = { ...current };
                delete next[id];
                return next;
              });
            }
          }}
        >
          {busy ? "发布中…" : "公开复盘"}
        </Button>
      </Sheet>
    </View>
  );
}
