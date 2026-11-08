"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  Briefcase,
  CandlestickChart,
  CheckCircle2,
  Landmark,
  Loader2,
  Newspaper,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStatus, ResearchAgent, Stance } from "@/lib/researchWorkspaceApi";

type Copy = (en: string, zh: string) => string;

export const AGENT_META: Record<ResearchAgent, { icon: LucideIcon; en: string; zh: string }> = {
  market: { icon: CandlestickChart, en: "Market", zh: "行情与技术" },
  fundamentals: { icon: Landmark, en: "Fundamentals", zh: "基本面" },
  news: { icon: Newspaper, en: "News", zh: "新闻与事件" },
  creators: { icon: Users, en: "Creators", zh: "博主观点" },
  portfolio: { icon: Briefcase, en: "Portfolio", zh: "我的持仓" },
};

export function agentName(agent: ResearchAgent, c: Copy) {
  const meta = AGENT_META[agent];
  return c(meta.en, meta.zh);
}

/** Direction as a written word in the semantic colour; never colour alone. */
export function StanceText({ stance, c, className }: { stance: Stance | null | undefined; c: Copy; className?: string }) {
  if (!stance) return null;
  const config = {
    bullish: { label: c("Bullish", "偏多"), tone: "text-positive" },
    bearish: { label: c("Bearish", "偏空"), tone: "text-negative" },
    neutral: { label: c("Neutral", "中性"), tone: "text-muted-foreground" },
    mixed: { label: c("Mixed", "分歧"), tone: "text-warning" },
  }[stance];
  return <span className={cn("whitespace-nowrap text-sm font-semibold", config.tone, className)}>{config.label}</span>;
}

export function AgentStatusText({ status, c }: { status: AgentStatus; c: Copy }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {c("Researching", "研究中")}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-negative">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {c("Failed", "失败")}
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {c("Done", "完成")}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{c("Queued", "排队")}</span>;
}

/**
 * One segment per researcher. A segment fills as that researcher finishes, so the
 * bar is a count, not decoration; failed segments stay hollow with a negative edge.
 */
export function RelayBar({ statuses, label }: { statuses: AgentStatus[]; label: string }) {
  const done = statuses.filter((s) => s === "completed" || s === "failed").length;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={statuses.length}
      aria-valuenow={done}
      className="flex gap-1"
    >
      {statuses.map((status, index) => (
        <span key={index} className="relative h-1 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
          <span
            className={cn(
              "absolute inset-0 origin-left rounded-full transition-transform duration-500 ease-spring motion-reduce:transition-none",
              status === "failed" ? "bg-negative/50" : "bg-foreground/60",
              status === "completed" || status === "failed" ? "scale-x-100" : status === "running" ? "scale-x-[0.35]" : "scale-x-0",
            )}
          />
        </span>
      ))}
    </div>
  );
}

export function ResearchMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words prose-a:text-foreground prose-a:underline",
        "prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:font-semibold prose-h1:text-base prose-h2:text-sm prose-h3:text-sm",
        "prose-p:my-1.5 prose-p:leading-6 prose-p:text-sm prose-ul:my-1.5 prose-ul:pl-4 prose-li:my-0.5 prose-li:text-sm",
        "prose-ol:my-1.5 prose-ol:pl-4 prose-strong:font-semibold prose-strong:text-foreground",
        "prose-table:block prose-table:max-w-full prose-table:overflow-x-auto prose-table:text-xs",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export function formatRunTime(iso: string | null | undefined, locale: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

const ERROR_COPY: Record<string, [string, string]> = {
  run_in_progress: ["A research run is already in progress.", "已有一轮研究正在进行。"],
  nothing_to_research: ["Add a ticker or a question first.", "请先添加股票或研究问题。"],
  invalid_ticker: ["One of the tickers is not valid.", "有股票代码格式不对。"],
  too_many_tickers: ["Use at most 10 tickers.", "最多 10 只股票。"],
  workspace_unavailable: ["Workspaces are unavailable right now.", "工作区暂时不可用。"],
  workspace_not_found: ["This workspace no longer exists.", "这个工作区已不存在。"],
};

export function workspaceErrorText(code: string | undefined, c: Copy) {
  const copy = code ? ERROR_COPY[code] : undefined;
  return copy ? c(copy[0], copy[1]) : c("Something went wrong. Try again.", "出了点问题，请重试。");
}
