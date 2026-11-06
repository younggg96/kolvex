"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, X } from "lucide-react";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { useCopy } from "@/components/decision/shared";
import { reportingQuarter, type HoldingActivity, type InstitutionSummary } from "@/lib/freeResearch";
import { cn } from "@/lib/utils";

export const superinvestorHref = (id: string) => `/dashboard/superinvestors/${encodeURIComponent(id)}`;

export function useActivityLabel() {
  const c = useCopy();
  return (kind: HoldingActivity) =>
    ({
      new: c("New", "新建仓"),
      increased: c("Added", "增持"),
      reduced: c("Reduced", "减持"),
      exited: c("Exited", "清仓"),
      unchanged: c("Unchanged", "不变"),
      unknown: c("Not compared", "未比较"),
    })[kind];
}

export const activityTone = (kind: HoldingActivity) =>
  kind === "new" || kind === "increased"
    ? "text-positive"
    : kind === "reduced" || kind === "exited"
      ? "text-negative"
      : "text-muted-foreground";

const ACTIVITY_ICON = { new: Plus, increased: ArrowUp, reduced: ArrowDown, exited: X, unchanged: Minus, unknown: Minus };

/** Written label plus icon, so direction never rests on color alone. */
export function ActivityBadge({ kind, className }: { kind: HoldingActivity; className?: string }) {
  const label = useActivityLabel();
  const Icon = ACTIVITY_ICON[kind];
  const fill =
    kind === "new" || kind === "increased"
      ? "bg-positive-fill/10"
      : kind === "reduced" || kind === "exited"
        ? "bg-negative-fill/10"
        : "bg-foreground/[0.06]";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        fill,
        activityTone(kind),
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" strokeWidth={2.5} />
      {label(kind)}
    </span>
  );
}

/** `2026 年第 2 季度` / `Q2 2026` for a 13F reporting period. */
export function useQuarterLabel() {
  const c = useCopy();
  return (period: string | null | undefined) => {
    const q = reportingQuarter(period);
    return q ? c(`Q${q.quarter} ${q.year}`, `${q.year} 年第 ${q.quarter} 季度`) : null;
  };
}

/**
 * Ranked shades for allocation segments. They mark rank, not direction, so they
 * stay neutral and leave green/orange for buy/sell activity.
 */
export const ALLOCATION_SHADES = [
  "bg-foreground/85",
  "bg-foreground/65",
  "bg-foreground/50",
  "bg-foreground/40",
  "bg-foreground/30",
  "bg-foreground/25",
  "bg-foreground/20",
  "bg-foreground/15",
  "bg-foreground/[0.12]",
  "bg-foreground/10",
];

/** One pill track showing how much of the book the top holdings take. */
export function AllocationBar({
  weights,
  label,
  className,
}: {
  weights: (number | null)[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("flex h-2 w-full gap-px overflow-hidden rounded-full bg-foreground/[0.07]", className)}
    >
      {weights.map((weight, index) =>
        weight && weight > 0 ? (
          <span
            key={index}
            className={cn("h-full first:rounded-l-full", ALLOCATION_SHADES[Math.min(index, ALLOCATION_SHADES.length - 1)])}
            style={{ width: `${Math.min(weight, 1) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

export const sumWeights = (rows: { weight: number | null }[]) => rows.reduce((sum, row) => sum + (row.weight ?? 0), 0);

/** New / added / reduced / exited counts, each with its written label. */
export function ChangeBreakdown({
  changes,
  className,
  compact = false,
}: {
  changes: InstitutionSummary["changes"];
  className?: string;
  compact?: boolean;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  if (!changes)
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {c("Quarter-over-quarter change not compared", "未比较季度变化")}
      </p>
    );
  const items: [HoldingActivity, number, string][] = [
    ["new", changes.new, compact ? c("New", "新建") : c("New", "新建仓")],
    ["increased", changes.increased, c("Added", "增持")],
    ["reduced", changes.reduced, c("Reduced", "减持")],
    ["exited", changes.exited, c("Exited", "清仓")],
  ];
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)}>
      {items.map(([kind, count, label]) => (
        <li key={kind} className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className="text-muted-foreground">{label}</span>
          <span className={cn("figure font-semibold", count ? activityTone(kind) : "text-muted-foreground")}>
            {f.number(count, false)}
          </span>
        </li>
      ))}
    </ul>
  );
}

type Bilingual = { en: string; zh: string };
export interface InvestorProfile {
  /** Chinese name the firm is commonly known by. */
  zhName: string;
  person: Bilingual;
  role: Bilingual;
  /** Vendored mark in /public/superinvestors; firms without a reliable mark use initials. */
  logo?: string;
}

const FOUNDER = { en: "Founder", zh: "创始人" };
const FOUNDER_CEO = { en: "Founder & CEO", zh: "创始人兼 CEO" };

/** Curated alongside the backend MANAGERS list; ids must match. */
export const INVESTOR_PROFILES: Record<string, InvestorProfile> = {
  berkshire: { zhName: "伯克希尔·哈撒韦", person: { en: "Warren Buffett", zh: "沃伦·巴菲特" }, role: { en: "Chairman", zh: "董事长" }, logo: "berkshire" },
  bridgewater: { zhName: "桥水基金", person: { en: "Ray Dalio", zh: "瑞·达利欧" }, role: FOUNDER, logo: "bridgewater" },
  pershing: { zhName: "潘兴广场", person: { en: "Bill Ackman", zh: "比尔·阿克曼" }, role: FOUNDER_CEO, logo: "pershing" },
  duquesne: { zhName: "杜肯家族办公室", person: { en: "Stanley Druckenmiller", zh: "斯坦利·德鲁肯米勒" }, role: FOUNDER },
  appaloosa: { zhName: "阿帕卢萨", person: { en: "David Tepper", zh: "大卫·泰珀" }, role: FOUNDER },
  baupost: { zhName: "包普斯特集团", person: { en: "Seth Klarman", zh: "塞斯·卡拉曼" }, role: { en: "CEO", zh: "CEO" } },
  tiger: { zhName: "老虎环球", person: { en: "Chase Coleman", zh: "蔡斯·科尔曼" }, role: FOUNDER, logo: "tiger" },
  third_point: { zhName: "第三点", person: { en: "Daniel Loeb", zh: "丹尼尔·勒布" }, role: FOUNDER_CEO },
  oaktree: { zhName: "橡树资本", person: { en: "Howard Marks", zh: "霍华德·马克斯" }, role: { en: "Co-founder", zh: "联合创始人" }, logo: "oaktree" },
  renaissance: { zhName: "文艺复兴科技", person: { en: "Jim Simons", zh: "吉姆·西蒙斯" }, role: FOUNDER, logo: "renaissance" },
};

/** Secondary identity line: Chinese firm name (zh only) and the investor behind it. */
export function useInvestorByline() {
  const c = useCopy();
  return (id: string, withRole = false) => {
    const profile = INVESTOR_PROFILES[id];
    if (!profile) return null;
    const person = c(profile.person.en, profile.person.zh);
    const role = c(profile.role.en, profile.role.zh);
    return c(
      withRole ? `${person}, ${role}` : person,
      [profile.zhName, person, withRole ? role : ""].filter(Boolean).join(" · "),
    );
  };
}

/** Firm mark when one is vendored, otherwise a neutral monogram. */
export function InvestorAvatar({ id, name, size = "md" }: { id: string; name: string; size?: "md" | "lg" | "xl" }) {
  const logo = INVESTOR_PROFILES[id]?.logo;
  const [failed, setFailed] = useState(false);
  if (!logo || failed) return <Monogram name={name} size={size} />;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 overflow-hidden rounded-full border border-foreground/10 bg-white",
        size === "xl" ? "h-14 w-14" : size === "lg" ? "h-12 w-12" : "h-10 w-10",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny vendored static mark */}
      <img src={`/superinvestors/${logo}.png`} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
    </span>
  );
}

/** Firms have no logo source here, so a neutral monogram keeps the cards scannable. */
export function Monogram({ name, size = "md" }: { name: string; size?: "md" | "lg" | "xl" }) {
  const letters = name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] font-semibold tracking-tight text-foreground/80",
        size === "xl" ? "h-14 w-14 text-lg" : size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm",
      )}
    >
      {letters || "·"}
    </span>
  );
}
