import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { router, useLocalSearchParams } from "expo-router";
import { AuthGate, Field, Pager } from "../../../components/Content";
import { Note, SecState, useFormat } from "../../../components/SecResearch";
import { CardsSkeleton } from "../../../components/Skeletons";
import { CompanyLogo } from "../../../components/CompanyLogo";
import { OptionGroup, OptionSheet } from "../../../components/OptionSheet";
import { Copy, Glass, Page, phone, styles } from "../../../components/UI";
import {
  CONGRESS_TICKER,
  congressTrades,
  type CongressTrade,
} from "../../../lib/congressApi";
import { useText } from "../../../lib/i18n";
import { safeExternal } from "../../../lib/links";
import { useTheme } from "../../../lib/theme";
import { useResource } from "../../../lib/useResource";
import { useAuth } from "../../../state/Auth";

const skeleton = (
  <CardsSkeleton
    count={5}
    lines={[
      { size: 16, width: "30%" },
      { size: 12, width: "70%" },
      { size: 14, width: "55%" },
      { size: 12, width: "45%" },
    ]}
  />
);
const SIDES = { buy: "买入", sell: "卖出", exchange: "交换", other: "其他" };
const CHAMBERS = { house: "众议院", senate: "参议院" };

export default function CongressTradesScreen() {
  const { ticker, member } = useLocalSearchParams<{
    ticker?: string;
    member?: string;
  }>();
  const initial =
    typeof ticker === "string" && CONGRESS_TICKER.test(ticker)
      ? ticker.toUpperCase()
      : "";
  const initialMember = typeof member === "string" ? member.slice(0, 100) : "";
  return (
    <AuthGate title="国会议员交易" skeleton={skeleton}>
      <Trades
        key={`${initial}:${initialMember}`}
        initialTicker={initial}
        initialMember={initialMember}
      />
    </AuthGate>
  );
}

type Filter = {
  ticker: string;
  member: string;
  chamber: string;
  direction: string;
};

function query({ ticker, member, chamber, direction }: Filter) {
  const params = new URLSearchParams();
  if (ticker) params.set("ticker", ticker);
  if (member.trim()) params.set("member", member.trim());
  if (chamber !== "all") params.set("chamber", chamber);
  if (direction !== "all") params.set("direction", direction);
  return params.toString();
}

function Trades({
  initialTicker,
  initialMember,
}: {
  initialTicker: string;
  initialMember: string;
}) {
  const t = useTheme();
  const user = useAuth().session!.user.id;
  // What the list shows; chamber, side and member apply as soon as they change.
  const [filter, setFilter] = useState<Filter>({
    ticker: initialTicker,
    member: initialMember,
    chamber: "all",
    direction: "all",
  });
  const [member, setMember] = useState("");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const applied = query(filter);
  const resource = useResource(
    `congress:${applied}:${page}:${user}`,
    (signal) => congressTrades(applied, page, user, signal),
    15_000,
  );
  const rows = resource.data?.trades ?? [];
  const filtered =
    filter.chamber !== "all" ||
    filter.direction !== "all" ||
    !!filter.member.trim();

  function apply(next: Partial<Filter>) {
    setFilter((old) => ({ ...old, ...next }));
    setPage(1);
  }

  return (
    <Page
      title="国会议员交易"
      actions={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="筛选交易"
          onPress={() => {
            setMember(filter.member);
            setOpen(true);
          }}
          hitSlop={4}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        >
          <Glass
            style={{
              width: phone(40),
              height: phone(40),
              borderRadius: phone(20),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SymbolView
              name={{
                ios: "line.3.horizontal.decrease",
                android: "filter_list",
                web: "filter_list",
              }}
              size={phone(16)}
              tintColor={t.text}
            />
          </Glass>
          {filtered && (
            <View
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: t.accent,
              }}
            />
          )}
        </Pressable>
      }
      onRefresh={resource.refresh}
      refreshing={resource.loading && !!resource.data}
    >
      {!!filter.ticker && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`移除股票筛选 ${filter.ticker}`}
          onPress={() => apply({ ticker: "" })}
          hitSlop={6}
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            minHeight: phone(36),
            paddingLeft: 4,
            paddingRight: 12,
            borderRadius: 999,
            backgroundColor: t.wash,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <CompanyLogo symbol={filter.ticker} size={phone(28)} />
          <Copy size={14} bold localize={false}>
            {filter.ticker}
          </Copy>
          <SymbolView
            name={{ ios: "xmark", android: "close", web: "close" }}
            size={phone(11)}
            tintColor={t.secondary}
          />
        </Pressable>
      )}
      <SecState
        resource={resource}
        skeleton={skeleton}
        empty={!rows.length}
        emptyText={
          resource.data?.synced
            ? "没有符合条件的披露记录。"
            : "国会交易披露数据尚未导入。"
        }
        errorText="暂时无法加载国会交易，请重试。"
      />
      {rows.length > 0 && (
        <Glass clear style={{ paddingHorizontal: 16 }}>
          {rows.map((row, index) => (
            <TradeRow key={row.id} row={row} first={index === 0} />
          ))}
        </Glass>
      )}
      {(page > 1 || !!resource.data?.has_more) && (
        <Pager
          page={page}
          hasMore={!!resource.data?.has_more}
          loading={resource.loading}
          onChange={setPage}
        />
      )}
      <Note>
        数据来源为 CongressInvests。金额按申报区间显示，申报可能晚于交易日。
      </Note>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <ExternalLink
          url="https://disclosures-clerk.house.gov/FinancialDisclosure"
          label="众议院披露"
        />
        <ExternalLink
          url="https://efdsearch.senate.gov/search/"
          label="参议院披露"
        />
      </View>
      <OptionSheet
        title="筛选交易"
        visible={open}
        onClose={() => {
          if (member.trim() !== filter.member) apply({ member: member.trim() });
          setOpen(false);
        }}
        onReset={
          filtered
            ? () => {
                setMember("");
                apply({ member: "", chamber: "all", direction: "all" });
              }
            : undefined
        }
      >
        <OptionGroup
          label="议院"
          options={[
            ["all", "全部"],
            ["house", "众议院"],
            ["senate", "参议院"],
          ]}
          value={filter.chamber}
          onChange={(chamber) => apply({ chamber })}
        />
        <OptionGroup
          label="交易类型"
          options={[
            ["all", "全部"],
            ["buy", "买入"],
            ["sell", "卖出"],
            ["exchange", "交换"],
            ["other", "其他"],
          ]}
          value={filter.direction}
          onChange={(direction) => apply({ direction })}
        />
        <Field
          label="议员姓名"
          placeholder="例如 Nancy Pelosi"
          value={member}
          maxLength={100}
          autoCorrect={false}
          textContentType="name"
          returnKeyType="done"
          onSubmitEditing={() => apply({ member: member.trim() })}
          onChangeText={setMember}
        />
      </OptionSheet>
    </Page>
  );
}

function TradeRow({ row, first }: { row: CongressTrade; first: boolean }) {
  const t = useTheme();
  const text = useText();
  const f = useFormat();
  const ticker = row.ticker?.toUpperCase();
  const tickerValid = !!ticker && CONGRESS_TICKER.test(ticker);
  const color =
    row.direction === "buy"
      ? t.accent
      : row.direction === "sell"
        ? t.negative
        : t.secondary;
  return (
    <Pressable
      accessibilityRole={tickerValid ? "link" : undefined}
      disabled={!tickerValid}
      onPress={() => router.push(`/stock/${encodeURIComponent(ticker!)}`)}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 12,
        paddingVertical: 14,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderColor: t.border,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      {ticker ? (
        <CompanyLogo symbol={ticker} size={phone(36)} />
      ) : (
        <View style={{ width: phone(36) }} />
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.row}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Copy size={16} bold localize={false}>
              {ticker || "证券"}
            </Copy>
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
                backgroundColor: t.wash,
              }}
            >
              <Copy size={12} bold color={color}>
                {SIDES[row.direction]}
              </Copy>
            </View>
          </View>
          <Copy size={14} bold localize={false}>
            {row.amount_range ?? "—"}
          </Copy>
        </View>
        <Copy size={13} lines={1} localize={false}>
          {row.member_name}
          {row.chamber ? ` · ${text(CHAMBERS[row.chamber])}` : ""}
        </Copy>
        <View style={styles.row}>
          <Copy size={12} muted>
            {`交易 ${f.date(row.trade_date)} · 申报 ${f.date(row.filed_date)}`}
          </Copy>
          {!!row.source_url && (
            <ExternalLink url={row.source_url} label="原文" />
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ExternalLink({ url, label }: { url: string; label: string }) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  const safe = safeExternal(url);
  if (!safe) return null;
  return (
    <Copy
      size={12}
      role="link"
      color={failed ? t.negative : t.accent}
      onPress={() => void Linking.openURL(safe).catch(() => setFailed(true))}
    >
      {label}
    </Copy>
  );
}
