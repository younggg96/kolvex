import { useState } from "react";
import { options, optionChain } from "../lib/featureApi";
import { useResource } from "../lib/useResource";
import { number } from "../lib/models";
import { Copy, Glass } from "./UI";
import { Field, Filters, Pager, ResourceState } from "./Content";
export function Options({ symbol }: { symbol: string }) {
  const dates = useResource(`options:${symbol}`, (s) => options(symbol, s));
  const [expiry, setExpiry] = useState("");
  const [side, setSide] = useState("calls");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const selected = expiry || dates.data?.expirations[0] || "";
  const chain = useResource(`chain:${symbol}:${selected}`, (s) =>
    selected ? optionChain(symbol, selected, s) : Promise.resolve(null),
  );
  const contracts =
    (side === "calls" ? chain.data?.calls : chain.data?.puts) ?? [];
  const filtered = contracts.filter(
    (c) =>
      !search ||
      String(c.strike).includes(search) ||
      c.contract_symbol?.includes(search.toUpperCase()),
  );
  return (
    <>
      <ResourceState
        resource={dates}
        empty={!dates.data?.expirations.length}
        message="暂无可用期权到期日"
      />
      <Filters
        values={(dates.data?.expirations ?? []).map((d) => [d, d] as const)}
        value={selected}
        onChange={(v) => {
          setExpiry(v);
          setPage(1);
        }}
      />
      <Filters
        values={[
          ["calls", "看涨 Call"],
          ["puts", "看跌 Put"],
        ]}
        value={side}
        onChange={(v) => {
          setSide(v);
          setPage(1);
        }}
      />
      <Field
        label="筛选行权价或合约"
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />
      <ResourceState
        resource={chain}
        empty={!!selected && !filtered.length}
        message="没有匹配合约"
      />
      {filtered.slice((page - 1) * 20, page * 20).map((c, i) => (
        <Glass key={c.contract_symbol || i} style={{ padding: 20, gap: 8 }}>
          <Copy bold>{c.contract_symbol || "合约代码未提供"}</Copy>
          <Copy>
            行权价 {number(c.strike)} · 最新 {number(c.last_price)}
          </Copy>
          <Copy>
            买价 {number(c.bid)} · 卖价 {number(c.ask)}
          </Copy>
          <Copy muted>
            成交量 {number(c.volume, 0)} · 未平仓 {number(c.open_interest, 0)}
          </Copy>
          <Copy muted>
            隐含波动率{" "}
            {c.implied_volatility == null
              ? "—"
              : `${number(c.implied_volatility * 100)}%`}{" "}
            ·{" "}
            {c.in_the_money == null
              ? "实值状态未提供"
              : c.in_the_money
                ? "实值"
                : "虚值"}
          </Copy>
        </Glass>
      ))}
      <Pager
        page={page}
        hasMore={page * 20 < filtered.length}
        loading={chain.loading}
        onChange={setPage}
      />
      <Copy size={12} muted>
        延迟期权报价，仅供研究；不提供下单。价差、流动性和合约乘数请以券商资料为准。
      </Copy>
    </>
  );
}
