"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useCopy } from "./shared";

// Official FOMC decision times and links accepted by the Polymarket embed
// builder. Keep upcoming meetings in chronological order.
const MEETINGS = [
  {
    decision: "2026-12-09T19:00:00Z",
    event: "fed-decision-in-december-20260729232808632",
    cut25: "will-the-fed-decrease-interest-rates-by-25-bps-after-the-december-2026-meeting-20260729232808634",
    cut50: "will-the-fed-decrease-interest-rates-by-50-bps-after-the-december-2026-meeting-20260729232808633",
  },
  {
    decision: "2027-01-27T19:00:00Z",
    event: "fed-decision-in-january-20260729233815502",
    cut25: "will-the-fed-decrease-interest-rates-by-25-bps-after-the-january-2027-meeting-20260729233815504",
    cut50: "will-the-fed-decrease-interest-rates-by-50-bps-after-the-january-2027-meeting-20260729233815503",
  },
  {
    decision: "2027-03-17T18:00:00Z",
    event: "fed-decision-in-march-2027",
    cut25: "will-the-fed-decrease-interest-rates-by-25-bps-after-the-march-2027-meeting",
    cut50: "will-the-fed-decrease-interest-rates-by-50-bps-after-the-march-2027-meeting",
  },
  {
    decision: "2027-04-28T18:00:00Z",
    event: "fed-decision-in-april-2027",
    cut25: "will-the-fed-decrease-interest-rates-by-25-bps-after-the-april-2027-meeting",
    cut50: "will-the-fed-decrease-interest-rates-by-50-bps-after-the-april-2027-meeting",
  },
] as const;

type Outcome = "cut25" | "cut50";

export default function FedCutChart() {
  const c = useCopy();
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>("cut25");
  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => setCheckedAt(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [open]);
  const meeting = open ? MEETINGS.find(({ decision }) => Date.parse(decision) > checkedAt) : undefined;
  const title = c("Fed rate cut probability", "美联储降息概率");
  const selected = outcome === "cut25" ? c("Cut by 25 bp", "降息 25 基点") : c("Cut by 50+ bp", "降息 50+ 基点");
  const date = meeting && new Intl.DateTimeFormat(c("en-US", "zh-CN"), {
    year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York",
  }).format(new Date(meeting.decision));
  const embed = meeting && new URLSearchParams({
    market: meeting[outcome], fit: "true", theme: resolvedTheme === "dark" ? "dark" : "light",
    buttons: "false", volume: "false",
  });
  const source = meeting ? `https://polymarket.com/event/${meeting.event}/${meeting[outcome]}` : "https://polymarket.com/economy/fed";

  return (
    <details className="group mt-4 rounded-3xl border border-foreground/10 glass-card bg-card-glass px-3 md:px-4" onToggle={(event) => {
      setCheckedAt(Date.now());
      setOpen(event.currentTarget.open);
    }}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 py-2 focus-visible:outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{c("Next FOMC meeting · Market estimate", "下次议息会议 · 市场预期")}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      {open && <div className="border-t border-border/60 pb-3 pt-3">
        {embed ? <>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="figure text-xs text-muted-foreground">{c(`Decision: ${date}`, `议息决议：${date}`)}</p>
            <SegmentedControl<Outcome> size="sm" value={outcome} onChange={setOutcome} label={c("Rate cut size", "降息幅度")} options={[
              { value: "cut25", label: c("25 bp", "25 基点") },
              { value: "cut50", label: c("50+ bp", "50+ 基点") },
            ]} />
          </div>
          <iframe
            title={`${title} · ${selected}`}
            src={`https://embed.polymarket.com/market?${embed}`}
            className="h-[26rem] w-full rounded-2xl border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
        </> : <p className="text-xs text-muted-foreground">{c("A chart for the next meeting is not available yet.", "下次会议的图表暂不可用。")}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
          <a href={source} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 hover:text-foreground focus-visible:underline">
            {meeting ? c("Change chart range on Polymarket", "前往 Polymarket 切换区间") : c("View on Polymarket", "在 Polymarket 查看")}<ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
          </a>
          <a href="https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html" target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 hover:text-foreground focus-visible:underline">
            {c("View CME FedWatch", "查看 CME FedWatch")}<ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
          </a>
        </div>
      </div>}
    </details>
  );
}
