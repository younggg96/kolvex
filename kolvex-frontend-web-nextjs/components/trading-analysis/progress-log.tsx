import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  BarChart3,
  Users,
  Newspaper,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Bot,
  Briefcase,
  ShieldCheck,
  Zap,
  Shield,
  Scale,
  Wrench,
  Brain,
  FileText,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgressEvent } from "@/lib/tradingAnalysisApi";

const NODE_AGENT_MAP: Record<string, string> = {
  "Market Analyst": "Market Analyst",
  tools_market: "Market Analyst",
  "Msg Clear Market": "Market Analyst",
  "Social Analyst": "Social Analyst",
  tools_social: "Social Analyst",
  "Msg Clear Social": "Social Analyst",
  "News Analyst": "News Analyst",
  tools_news: "News Analyst",
  "Msg Clear News": "News Analyst",
  "Fundamentals Analyst": "Fundamentals Analyst",
  tools_fundamentals: "Fundamentals Analyst",
  "Msg Clear Fundamentals": "Fundamentals Analyst",
  "Bull Researcher": "Bull Researcher",
  "Bear Researcher": "Bear Researcher",
  "Research Manager": "Research Manager",
  Trader: "Trader",
  "Aggressive Analyst": "Aggressive Analyst",
  "Conservative Analyst": "Conservative Analyst",
  "Neutral Analyst": "Neutral Analyst",
  "Risk Judge": "Risk Judge",
};

interface AgentTheme {
  icon: LucideIcon;
  accent: string;
  bg: string;
  border: string;
  text: string;
}

const NEUTRAL = {
  accent: "text-foreground",
  bg: "bg-foreground/[0.06]",
  border: "border-foreground/10",
  text: "text-foreground/80",
};

const AGENT_THEMES: Record<string, AgentTheme> = {
  "Market Analyst": { ...NEUTRAL, icon: BarChart3 },
  "Social Analyst": { ...NEUTRAL, icon: Users },
  "News Analyst": { ...NEUTRAL, icon: Newspaper },
  "Fundamentals Analyst": { ...NEUTRAL, icon: DollarSign },
  "Bull Researcher": { ...NEUTRAL, icon: TrendingUp, accent: "text-positive", border: "border-positive/30" },
  "Bear Researcher": { ...NEUTRAL, icon: TrendingDown, accent: "text-negative", border: "border-negative/30" },
  "Research Manager": { ...NEUTRAL, icon: Scale },
  Trader: { ...NEUTRAL, icon: Briefcase },
  "Aggressive Analyst": { ...NEUTRAL, icon: Zap },
  "Conservative Analyst": { ...NEUTRAL, icon: Shield },
  "Neutral Analyst": { ...NEUTRAL, icon: Scale },
  "Risk Judge": { ...NEUTRAL, icon: ShieldCheck },
};

const DEFAULT_THEME: AgentTheme = { ...NEUTRAL, icon: Bot };

interface AgentGroup {
  agentName: string;
  events: ProgressEvent[];
  toolCalls: string[];
  latestDetail?: string;
  latestDetailType?: string;
  elapsed?: number;
  isActive: boolean;
}

function getAgentName(node?: string): string {
  if (!node) return "System";
  return NODE_AGENT_MAP[node] || node;
}

function groupByAgent(events: ProgressEvent[]): AgentGroup[] {
  const groups: AgentGroup[] = [];
  let currentAgent: string | null = null;
  let currentGroup: AgentGroup | null = null;

  for (const ev of events) {
    const agent = getAgentName(ev.node);

    if (agent !== currentAgent) {
      if (currentGroup) groups.push(currentGroup);
      currentAgent = agent;
      currentGroup = {
        agentName: agent,
        events: [],
        toolCalls: [],
        isActive: false,
      };
    }

    currentGroup!.events.push(ev);
    currentGroup!.elapsed = ev.elapsed;

    if (ev.detail_type === "tool_call" && ev.detail) {
      currentGroup!.toolCalls.push(ev.detail);
    } else if (ev.detail_type === "tool_result" && ev.detail) {
      currentGroup!.toolCalls.push(`→ ${ev.detail}`);
    }

    if (
      ev.detail &&
      (ev.detail_type === "thinking" || ev.detail_type === "report_preview")
    ) {
      currentGroup!.latestDetail = ev.detail;
      currentGroup!.latestDetailType = ev.detail_type;
    }
  }

  if (currentGroup) groups.push(currentGroup);

  if (groups.length > 0) {
    groups[groups.length - 1].isActive = true;
  }

  return groups;
}

function TypewriterText({
  text,
  active,
  speed = 8,
}: {
  text: string;
  active: boolean;
  speed?: number;
}) {
  const [charIdx, setCharIdx] = useState(0);
  const prevTextRef = useRef("");

  useEffect(() => {
    if (!active || !text) {
      setCharIdx(text?.length || 0);
      return;
    }

    const startFrom = text.startsWith(prevTextRef.current)
      ? prevTextRef.current.length
      : 0;

    setCharIdx(startFrom);

    let i = startFrom;
    const timer = setInterval(() => {
      i += 1;
      if (i >= text.length) {
        setCharIdx(text.length);
        clearInterval(timer);
        prevTextRef.current = text;
      } else {
        setCharIdx(i);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, active, speed]);

  if (!text) return null;

  return (
    <span>
      {text.slice(0, charIdx)}
      {active && charIdx < text.length && (
        <span className="inline-block w-[2px] h-[1em] bg-current align-text-bottom animate-blink-cursor ml-px" />
      )}
    </span>
  );
}

function AgentStep({
  group,
  isLast,
}: {
  group: AgentGroup;
  isLast: boolean;
}) {
  const theme = AGENT_THEMES[group.agentName] || DEFAULT_THEME;
  const Icon = theme.icon;
  const isSystem = group.agentName === "System";
  const [expanded, setExpanded] = useState(true);

  const hasDetail = !!(
    group.latestDetail ||
    group.toolCalls.length > 0
  );

  const toggleExpanded = useCallback(() => {
    if (hasDetail) setExpanded((p) => !p);
  }, [hasDetail]);

  if (isSystem) {
    return (
      <div className="space-y-0.5">
        {group.events.map((ev, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs text-muted-foreground animate-slide-in"
          >
            <CheckCircle2 className="w-3 h-3 text-positive shrink-0" />
            <span className="truncate">{ev.message || ev.stage}</span>
            {ev.elapsed != null && (
              <span className="ml-auto text-[11px] text-muted-foreground tabular-nums shrink-0">
                {ev.elapsed}s
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors duration-200 animate-slide-in overflow-hidden",
        group.isActive
          ? `${theme.border} ${theme.bg}`
          : "border-transparent bg-transparent"
      )}
    >
      {/* Agent header */}
      <button
        type="button"
        onClick={toggleExpanded}
        className={cn(
          "flex items-center gap-2 w-full px-2.5 py-1.5 text-left",
          hasDetail && "cursor-pointer hover:bg-foreground/[0.03]"
        )}
      >
        <div
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
            theme.bg
          )}
        >
          {group.isActive ? (
            <Loader2
              className={cn("w-3 h-3 animate-spin", theme.accent)}
            />
          ) : (
            <Icon
              className={cn(
                "w-3 h-3",
                theme.accent
              )}
            />
          )}
        </div>
        <span
          className={cn(
            "text-xs font-semibold truncate",
            group.isActive ? theme.accent : "text-foreground"
          )}
        >
          {group.agentName}
        </span>
        {group.isActive && (
          <span className="flex items-center gap-1 ml-1">
            <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
            <span
              className="w-1 h-1 rounded-full bg-current animate-pulse"
              style={{ animationDelay: "200ms" }}
            />
            <span
              className="w-1 h-1 rounded-full bg-current animate-pulse"
              style={{ animationDelay: "400ms" }}
            />
          </span>
        )}
        {group.elapsed != null && (
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums shrink-0">
            {group.elapsed}s
          </span>
        )}
        {hasDetail && (
          <ChevronDown
            className={cn(
              "w-3 h-3 text-muted-foreground shrink-0 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="px-2.5 pb-2 space-y-1.5 animate-fade-in">
          {/* Tool calls */}
          {group.toolCalls.length > 0 && (
            <div className="space-y-0.5 ml-1">
              {group.toolCalls.map((tc, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 text-[11px] text-muted-foreground font-mono animate-slide-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {tc.startsWith("→") ? (
                    <FileText className="w-3 h-3 shrink-0 mt-px" />
                  ) : (
                    <Wrench className="w-3 h-3 shrink-0 mt-px" />
                  )}
                  <span className="break-all">{tc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Thinking / Report detail */}
          {group.latestDetail && (
            <div
              className={cn(
                "rounded-lg bg-foreground/[0.04] px-2.5 py-1.5 text-xs leading-relaxed",
                group.isActive ? theme.text : "text-muted-foreground"
              )}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <Brain className="w-2.5 h-2.5 opacity-60" />
                <span className="text-[11px] font-medium opacity-70">
                  {group.latestDetailType === "report_preview"
                    ? "Report"
                    : "Thinking"}
                </span>
              </div>
              <div className="line-clamp-4">
                {group.isActive ? (
                  <TypewriterText
                    text={group.latestDetail}
                    active={group.isActive}
                  />
                ) : (
                  group.latestDetail
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProgressLog({
  events,
  isLive = true,
}: {
  events: ProgressEvent[];
  isLive?: boolean;
}) {
  const groups = useMemo(() => groupByAgent(events), [events]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [groups.length, events.length]);

  return (
    <div className="overflow-hidden rounded-xl bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-foreground">Agent activity</span>
        <div className="ml-auto flex items-center gap-1.5" aria-live="polite">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isLive ? "bg-positive-fill" : "bg-warning"
            )}
          />
          <span className="text-[11px] text-muted-foreground">
            {isLive ? "Live" : "Syncing"}
          </span>
        </div>
      </div>

      {/* Activity feed */}
      <div
        ref={scrollRef}
        className="p-2.5 space-y-1.5 max-h-80 overflow-y-auto"
      >
        {groups.map((group, i) => (
          <AgentStep
            key={`${group.agentName}-${i}`}
            group={group}
            isLast={i === groups.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
