import { useState } from "react";
import { Linking, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AuthGate, Field, Filters, Pager } from "../components/Content";
import { Note, SecState, useFormat } from "../components/SecResearch";
import { CardsSkeleton } from "../components/Skeletons";
import { Button, Copy, Glass, Page, styles } from "../components/UI";
import {
  CONGRESS_TICKER,
  congressTrades,
  type CongressTrade,
} from "../lib/congressApi";
import { safeExternal } from "../lib/links";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";

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
  const { ticker } = useLocalSearchParams<{ ticker?: string }>();
  const initial =
    typeof ticker === "string" && CONGRESS_TICKER.test(ticker)
      ? ticker.toUpperCase()
      : "";
  return (
    <AuthGate title="国会议员交易" skeleton={skeleton}>
      <Trades key={initial} initialTicker={initial} />
    </AuthGate>
  );
}

function Trades({ initialTicker }: { initialTicker: string }) {
  const user = useAuth().session!.user.id;
  const [filters, setFilters] = useState({
    ticker: initialTicker,
    member: "",
    chamber: "all",
    direction: "all",
  });
  const [applied, setApplied] = useState(
    initialTicker ? `ticker=${encodeURIComponent(initialTicker)}` : "",
  );
  const [page, setPage] = useState(1);
  const [invalidTicker, setInvalidTicker] = useState(false);
  const resource = useResource(
    `congress:${applied}:${page}:${user}`,
    (signal) => congressTrades(applied, page, user, signal),
    15_000,
  );
  const rows = resource.data?.trades ?? [];

  function submit() {
    const ticker = filters.ticker.trim();
    if (ticker && !CONGRESS_TICKER.test(ticker)) {
      setInvalidTicker(true);
      return;
    }
    const params = new URLSearchParams();
    if (ticker) params.set("ticker", ticker.toUpperCase());
    if (filters.member.trim()) params.set("member", filters.member.trim());
    if (filters.chamber !== "all") params.set("chamber", filters.chamber);
    if (filters.direction !== "all") params.set("direction", filters.direction);
    setApplied(params.toString());
    setPage(1);
  }

  return (
    <Page
      title="国会议员交易"
      onRefresh={resource.refresh}
      refreshing={resource.loading && !!resource.data}
    >
      <Glass style={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="股票代码"
              placeholder="NVDA"
              value={filters.ticker}
              maxLength={20}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={submit}
              error={invalidTicker ? "请输入有效的股票代码。" : undefined}
              onChangeText={(value) => {
                setInvalidTicker(false);
                setFilters((old) => ({ ...old, ticker: value }));
              }}
            />
          </View>
          <View style={{ flex: 1.5 }}>
            <Field
              label="议员姓名"
              value={filters.member}
              maxLength={100}
              autoCorrect={false}
              textContentType="name"
              returnKeyType="search"
              onSubmitEditing={submit}
              onChangeText={(value) =>
                setFilters((old) => ({ ...old, member: value }))
              }
            />
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Copy size={14} bold>
            议院
          </Copy>
          <Filters
            values={[
              ["all", "参众两院"],
              ["house", "众议院"],
              ["senate", "参议院"],
            ]}
            value={filters.chamber}
            onChange={(chamber) => setFilters((old) => ({ ...old, chamber }))}
          />
        </View>
        <View style={{ gap: 8 }}>
          <Copy size={14} bold>
            交易类型
          </Copy>
          <Filters
            values={[
              ["all", "全部交易"],
              ["buy", "买入"],
              ["sell", "卖出"],
              ["exchange", "交换"],
              ["other", "其他"],
            ]}
            value={filters.direction}
            onChange={(direction) =>
              setFilters((old) => ({ ...old, direction }))
            }
          />
        </View>
        <Button variant="primary" onPress={submit}>
          应用筛选
        </Button>
      </Glass>
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
        <Glass style={{ paddingHorizontal: 16 }}>
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
    </Page>
  );
}

function TradeRow({ row, first }: { row: CongressTrade; first: boolean }) {
  const t = useTheme();
  const f = useFormat();
  const tickerValid = !!row.ticker && CONGRESS_TICKER.test(row.ticker);
  const color =
    row.direction === "buy"
      ? t.accent
      : row.direction === "sell"
        ? t.negative
        : t.text;
  return (
    <View
      style={{
        gap: 8,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderColor: t.border,
      }}
    >
      <View style={styles.row}>
        {row.ticker ? (
          <Copy
            bold
            localize={false}
            color={tickerValid ? t.accent : undefined}
            role={tickerValid ? "link" : undefined}
            onPress={
              tickerValid
                ? () =>
                    router.push(
                      `/stock/${encodeURIComponent(row.ticker!.toUpperCase())}`,
                    )
                : undefined
            }
          >
            {row.ticker}
          </Copy>
        ) : (
          <Copy bold>证券</Copy>
        )}
        <Copy size={14} bold color={color}>
          {SIDES[row.direction]}
        </Copy>
      </View>
      {!!row.asset_name && (
        <Copy size={12} muted lines={2} localize={false}>
          {row.asset_name}
        </Copy>
      )}
      <View style={styles.row}>
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
          <Copy size={14} localize={false}>
            {row.member_name}
          </Copy>
          {!!row.chamber && (
            <>
              <Copy size={12} muted localize={false}>
                {" · "}
              </Copy>
              <Copy size={12} muted>
                {CHAMBERS[row.chamber]}
              </Copy>
            </>
          )}
        </View>
        <Copy
          size={14}
          bold
          localize={false}
        >
          {row.amount_range ?? "—"}
        </Copy>
      </View>
      <View style={styles.row}>
        <Copy size={12} muted>
          {`申报日 ${f.date(row.filed_date)} · 交易日 ${f.date(row.trade_date)}`}
        </Copy>
        {!!row.source_url && <ExternalLink url={row.source_url} label="原文" />}
      </View>
    </View>
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
