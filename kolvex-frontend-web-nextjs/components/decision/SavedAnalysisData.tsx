"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { AiTechnicalAnalysis } from "@/lib/stockApi";
import type { AnalysisVersion } from "@/lib/stockAnalysisHistory";
import { useCopy } from "./shared";

export default function SavedAnalysisData({ version }: { version: AnalysisVersion<AiTechnicalAnalysis> }) {
  const c = useCopy();
  const { t } = useTranslation();
  const [shown, setShown] = useState(20);
  const bars = version.bars || [];
  const number = new Intl.NumberFormat(t("common.intlLocale"), { maximumFractionDigits: 4 });
  return <details className="mt-3 border-t border-border pt-3">
    <summary className="cursor-pointer text-sm font-medium">{c("Saved analysis data", "分析时的数据")}</summary>
    <p className="mt-2 text-xs text-muted-foreground">{version.payload.interval} · {version.payload.view.start} – {version.payload.view.end}</p>
    <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Object.entries(version.payload.indicators).map(([key, value]) => <div key={key}>
        <dt className="text-xs text-muted-foreground">{key.toUpperCase()}</dt>
        <dd className="figure mt-1 text-sm">{typeof value === "number" ? number.format(value) : "—"}</dd>
      </div>)}
    </dl>
    {!!bars.length && <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-xs tabular-nums">
          <caption className="mb-2 text-left text-muted-foreground">{c("Original market data used for this analysis", "本次分析使用的原始行情数据")} ({bars.length})</caption>
          <thead><tr>{[c("Time", "时间"), c("Open", "开盘"), c("High", "最高"), c("Low", "最低"), c("Close", "收盘"), c("Volume", "成交量")].map(label => <th key={label} scope="col" className="border-b border-border px-2 py-2 font-medium">{label}</th>)}</tr></thead>
          <tbody>{bars.slice(0, shown).map(bar => <tr key={bar.date}><th scope="row" className="border-b border-border px-2 py-2 font-normal">{bar.date}</th>{[bar.open, bar.high, bar.low, bar.close, bar.volume].map((value, index) => <td key={index} className="border-b border-border px-2 py-2">{value === null ? "—" : number.format(value)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {shown < bars.length && <Button size="sm" variant="outline" className="mt-3" onClick={() => setShown(value => value + 50)}>{c("Show more market data", "显示更多行情数据")}</Button>}
    </>}
  </details>;
}
