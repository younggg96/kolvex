import { useState } from "react";
import { CardsSkeleton } from "./Skeletons";
import { calendarDate } from "../lib/technicalData";
import { catalogue } from "../lib/featureApi";
import { useResource } from "../lib/useResource";
import { Filters, Field, Pager, ResourceState } from "./Content";
import { Copy, Button } from "./UI";
import { OpinionCard } from "./OpinionCard";
import { OpinionOverview } from "./OpinionOverview";
export function StockOpinions({ symbol }: { symbol: string }) {
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  const r = useResource(
    `stock-opinions:${symbol}:${direction}:${page}:${dates.from}:${dates.to}`,
    (signal) =>
      catalogue(
        signal,
        `&ticker=${encodeURIComponent(symbol)}&offset=${(page - 1) * 20}${direction === "all" ? "" : `&sentiment=${direction}`}${dates.from ? `&date_from=${dates.from}` : ""}${dates.to ? `&date_to=${dates.to}` : ""}`,
      ),
  );
  return (
    <>
      <Filters
        values={[
          ["all", "全部方向"],
          ["bullish", "看多"],
          ["bearish", "看空"],
          ["neutral", "中性"],
          ["mixed", "分歧"],
        ]}
        value={direction}
        onChange={(v) => {
          setDirection(v);
          setPage(1);
        }}
      />
      <Field
        label="开始日期 YYYY-MM-DD（可留空）"
        value={from}
        onChangeText={setFrom}
      />
      <Field
        label="结束日期 YYYY-MM-DD（可留空）"
        value={to}
        onChangeText={setTo}
      />
      <Button
        disabled={
          (!!from && !calendarDate(from)) ||
          (!!to && !calendarDate(to)) ||
          (!!from && !!to && from > to)
        }
        onPress={() => {
          setDates({ from, to });
          setPage(1);
        }}
      >
        应用日期范围
      </Button>
      <ResourceState skeleton={<><CardsSkeleton count={1} lines={[{ size: 20, width: "40%" }, { size: 16, width: "30%" }, { size: 12, width: "50%" }]} chartHeight={120} /><CardsSkeleton lines={[{ size: 16, width: "40%" }, { size: 12, width: "50%" }, { size: 16, width: "60%", lines: 3 }]} buttons={1} /></>}
        resource={r}
        empty={!r.data?.latest.length}
        message="此范围没有已收录的股票观点。"
      />
      {!r.loading && r.data && (
        <OpinionOverview summary={r.data.summary} daily={r.data.daily} />
      )}
      {r.data?.latest.map((o) => (
        <OpinionCard key={o.id} item={o} />
      ))}
      <Pager
        page={page}
        hasMore={r.data?.pagination?.has_more || false}
        loading={r.loading}
        onChange={setPage}
      />
      <Copy muted size={12}>
        来源观点与市场价格可属于不同日期，不构成交易信号。
      </Copy>
    </>
  );
}
